import express from "express";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { readFileSync, existsSync } from "fs";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  getApiKeyInfo,
  executeToolCall,
  generateChatTitle,
} from "../services/ai.js";

// Helper to convert file to base64 data URL
function getFileAsDataUrl(filePath, mimetype) {
  if (!existsSync(filePath)) return null;
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimetype};base64,${base64}`;
}

const router = express.Router();
router.use(authMiddleware);

// Send message and get AI response
router.post("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, reasoning, attachment_ids = [] } = req.body;

    // Fetch attachments if provided
    let attachments = [];
    if (attachment_ids.length > 0) {
      attachments = db
        .prepare(
          `SELECT * FROM file_uploads WHERE id IN (${attachment_ids.map(() => "?").join(",")}) AND user_id = ?`
        )
        .all(...attachment_ids, req.user.id);
    }

    // Verify chat ownership and get message count
    const chat = db
      .prepare(
        `
      SELECT c.*, COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.id = ? AND c.user_id = ?
      GROUP BY c.id
    `,
      )
      .get(chatId, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Get API key info
    const apiKeyInfo = await getApiKeyInfo(req.user.id);
    if (!apiKeyInfo) {
      return res.status(400).json({
        error:
          "No API key configured. Please set your OpenRouter API key in settings or ask an admin to enable the default key for you.",
      });
    }
    const { key: apiKey, isDefault: usedDefaultKey } = apiKeyInfo;

    // Validate model for users using the default key who don't have can_use_default_key permission
    if (usedDefaultKey && !req.user.is_admin) {
      // Check if user's group has can_use_default_key permission
      const user = db.prepare('SELECT user_group FROM users WHERE id = ?').get(req.user.id);
      const groupId = user?.user_group || 'user';
      const group = db.prepare('SELECT permissions FROM user_groups WHERE id = ?').get(groupId);

      let hasDefaultKeyPermission = false;
      if (group?.permissions) {
        try {
          const permissions = JSON.parse(group.permissions);
          hasDefaultKeyPermission = permissions.can_use_default_key === true;
        } catch (e) {
          console.error('Error parsing group permissions:', e);
        }
      }

      // Only apply whitelist if user doesn't have can_use_default_key permission
      if (!hasDefaultKeyPermission) {
        // Get model whitelist
        const whitelistSetting = db.prepare("SELECT value FROM settings WHERE key = 'guest_model_whitelist'").get();
        let modelWhitelist = [];
        if (whitelistSetting?.value) {
          try {
            modelWhitelist = JSON.parse(whitelistSetting.value);
          } catch (e) {
            console.error('Failed to parse guest_model_whitelist:', e);
          }
        }

        // If whitelist check applies, strictly enforce it (empty whitelist = no models allowed)
        if (!modelWhitelist.includes(chat.model)) {
          return res.status(403).json({
            error: "This model is not available when using the default API key. Please add your own API key in settings or ask an admin to whitelist models."
          });
        }
      }
    }

    // Generate title concurrently if chat has default name and this is the first message
    // Fire and forget - but we want to send the result down the stream
    if (chat.title === "New Chat" && chat.message_count === 0) {
      generateChatTitle(content, req.user.id)
        .then((generatedTitle) => {
          if (generatedTitle) {
            try {
              db.prepare(
                `
              UPDATE chats SET title = ? WHERE id = ?
            `,
              ).run(generatedTitle, chatId);

              // Send title update event if stream is still open
              if (!res.writableEnded) {
                res.write(
                  `data: ${JSON.stringify({ type: "title", content: generatedTitle })}\n\n`,
                );
              }
            } catch (err) {
              console.error("Failed to update chat title:", err);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to generate chat title:", err);
        });
    }

    // Save user message
    const userMessageId = uuidv4();
    db.prepare(
      `
      INSERT INTO messages (id, chat_id, role, content)
      VALUES (?, ?, 'user', ?)
    `,
    ).run(userMessageId, chatId, content);

    // Link attachments to the user message
    if (attachments.length > 0) {
      const updateStmt = db.prepare(
        `UPDATE file_uploads SET message_id = ?, chat_id = ? WHERE id = ?`
      );
      for (const attachment of attachments) {
        updateStmt.run(userMessageId, chatId, attachment.id);
      }
    }

    // Get conversation history
    const messages = db
      .prepare(
        `
      SELECT role, content, reasoning_content, tool_calls, tool_call_id, name
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `,
      )
      .all(chatId);

    // Build OpenAI messages array
    const openaiMessages = [];

    // Fetch global system prompt from settings
    const globalPromptSetting = db
      .prepare(`SELECT value FROM settings WHERE key = 'global_system_prompt'`)
      .get();
    const globalSystemPrompt = globalPromptSetting?.value;

    // Inject global system prompt first (if set)
    if (globalSystemPrompt) {
      openaiMessages.push({
        role: "system",
        content: globalSystemPrompt,
      });
    }

    // Then inject chat-specific system prompt (if set)
    if (chat.system_prompt) {
      openaiMessages.push({
        role: "system",
        content: chat.system_prompt,
      });
    }

    // Inject Depth modifiers
    if (chat.depth === 'concise') {
      openaiMessages.push({ role: "system", content: "Please provide concise, direct answers without unnecessary elaboration." });
    } else if (chat.depth === 'detailed') {
      openaiMessages.push({ role: "system", content: "Please provide comprehensive, detailed explanations covering all aspects of the topic." });
    }

    // Inject Tone modifiers
    if (chat.tone === 'professional') {
      openaiMessages.push({ role: "system", content: "Maintain a formal, professional, and objective tone." });
    } else if (chat.tone === 'friendly') {
      openaiMessages.push({ role: "system", content: "Be warm, friendly, and conversational." });
    } else if (chat.tone === 'enthusiastic') {
      openaiMessages.push({ role: "system", content: "Be energetic, enthusiastic, and encouraging in your responses." });
    }

    // Get user memories for context
    const memories = db
      .prepare(
        `
      SELECT content FROM memories
      WHERE user_id = ?
      ORDER BY importance DESC, updated_at DESC
      LIMIT 5
    `,
      )
      .all(req.user.id);

    if (memories.length > 0) {
      const memoryContext = memories.map((m) => m.content).join("\n");
      openaiMessages.push({
        role: "system",
        content: `Previous context about the user:\n${memoryContext}`,
      });
    }

    // Get all attachments for this chat's messages
    const chatAttachments = db
      .prepare(
        `SELECT * FROM file_uploads WHERE chat_id = ? AND message_id IS NOT NULL`
      )
      .all(chatId);

    // Group attachments by message_id
    const attachmentsByMessage = {};
    for (const att of chatAttachments) {
      if (!attachmentsByMessage[att.message_id]) {
        attachmentsByMessage[att.message_id] = [];
      }
      attachmentsByMessage[att.message_id].push(att);
    }

    // Inject document context from current attachments
    if (attachments.length > 0) {
      const documentContextParts = [];
      for (const att of attachments) {
        if (att.extracted_text && att.extraction_status === "completed") {
          documentContextParts.push(
            `--- Document: ${att.original_name} ---\n${att.extracted_text}\n--- End of ${att.original_name} ---`
          );
        }
      }

      if (documentContextParts.length > 0) {
        openaiMessages.push({
          role: "system",
          content: `The user has attached the following document(s) for analysis:\n\n${documentContextParts.join("\n\n")}`,
        });
      }
    }

    for (const msg of messages) {
      const msgAttachments = attachmentsByMessage[msg.id] || [];

      // Build message content - use multi-modal format if attachments exist
      let messageContent;
      if (msgAttachments.length > 0 && msg.role === "user") {
        // Multi-modal content with images
        messageContent = [{ type: "text", text: msg.content }];

        for (const att of msgAttachments) {
          if (att.mimetype.startsWith("image/")) {
            const dataUrl = getFileAsDataUrl(att.storage_path, att.mimetype);
            if (dataUrl) {
              messageContent.push({
                type: "image_url",
                image_url: { url: dataUrl },
              });
            }
          }
        }
      } else {
        messageContent = msg.content;
      }

      const openaiMsg = {
        role: msg.role,
        content: messageContent,
      };

      if (msg.reasoning_content) {
        // Reasoning is now saved in separate messages, no need to prepend to content
        // The separate assistant messages with reasoning will be loaded in sequence
      }

      if (msg.tool_calls) {
        openaiMsg.tool_calls = JSON.parse(msg.tool_calls);
      }

      if (msg.tool_call_id) {
        openaiMsg.tool_call_id = msg.tool_call_id;
      }

      if (msg.name) {
        openaiMsg.name = msg.name;
      }

      openaiMessages.push(openaiMsg);
    }

    // Add current message attachments to the last message if not already included
    if (attachments.length > 0) {
      const lastMsg = openaiMessages[openaiMessages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        // Convert to multi-modal if not already
        if (typeof lastMsg.content === "string") {
          lastMsg.content = [{ type: "text", text: lastMsg.content }];
        }

        for (const att of attachments) {
          if (att.mimetype.startsWith("image/")) {
            const dataUrl = getFileAsDataUrl(att.storage_path, att.mimetype);
            if (dataUrl) {
              lastMsg.content.push({
                type: "image_url",
                image_url: { url: dataUrl },
              });
            }
          }
        }
      }
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    // Prepare request options
    const requestOptions = {
      model: chat.model,
      messages: openaiMessages,
      temperature: chat.temperature,
      stream: true,
      usage: { include: true },
    };

    // Add reasoning configuration if enabled (OpenRouter format)
    if (reasoning) {
      requestOptions.reasoning = reasoning;
    }

    // Always include enabled tools - OpenRouter handles gracefully if model doesn't support them
    const tools = db
      .prepare(
        `
      SELECT name, description, parameters
      FROM tools
      WHERE enabled = 1
    `,
      )
      .all();

    // Filter out workspace_search if not in a workspace
    const filteredTools = tools.filter(t =>
      t.name !== 'workspace_search' || chat.workspace_id
    );

    if (filteredTools.length > 0) {
      requestOptions.tools = filteredTools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: JSON.parse(t.parameters),
        },
      }));
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let assistantMessage = "";
    let assistantReasoning = "";
    let toolCalls = [];
    let usageData = null;
    const responseGroupId = uuidv4();
    let allAssistantMessageIds = [];
    let currentAssistantMessageId = uuidv4();

    // Step-based tracking for timeline display
    let steps = [];
    let currentStepId = null;
    let stepIndex = 0;
    let currentReasoningStepId = null;

    // Helper to start a new step
    const startStep = (stepType, extraData = {}) => {
      const stepId = uuidv4();
      currentStepId = stepId;
      const step = {
        id: stepId,
        type: stepType,
        index: stepIndex++,
        content: "",
        startTime: Date.now(),
        messageId: currentAssistantMessageId,
        ...extraData
      };
      steps.push(step);
      res.write(`data: ${JSON.stringify({
        type: "step_start",
        step_id: stepId,
        step_type: stepType,
        step_index: step.index,
        ...extraData
      })}\n\n`);
      return stepId;
    };

    // Helper to append content to current step
    const appendStepContent = (stepId, content) => {
      const step = steps.find(s => s.id === stepId);
      if (step) {
        step.content += content;
        res.write(`data: ${JSON.stringify({
          type: "step_content",
          step_id: stepId,
          content: content
        })}\n\n`);
      }
    };

    // Helper to complete a step
    const completeStep = (stepId) => {
      const step = steps.find(s => s.id === stepId);
      if (step) {
        step.duration_ms = Date.now() - step.startTime;
        step.isComplete = true;
        res.write(`data: ${JSON.stringify({
          type: "step_complete",
          step_id: stepId,
          duration_ms: step.duration_ms
        })}\n\n`);
      }
    };

    console.log(`Starting stream for model: ${chat.model}`);
    const requestStartTime = Date.now();
    const stream = await openai.chat.completions.create(requestOptions);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Capture usage data if present (usually in final chunk)
      if (chunk.usage) {
        usageData = chunk.usage;
      }

      if (!delta) continue;

      // Detect reasoning in various possible fields
      const reasoning =
        delta.reasoning_content || delta.reasoning || delta.thought;

      if (reasoning) {
        // Start a reasoning step if we don't have one active
        if (!currentReasoningStepId) {
          currentReasoningStepId = startStep("reasoning");
        }
        assistantReasoning += reasoning;
        appendStepContent(currentReasoningStepId, reasoning);
        // Also send legacy event for backward compatibility
        res.write(
          `data: ${JSON.stringify({ type: "reasoning", content: reasoning })}\n\n`,
        );
      }

      if (delta.content) {
        // Complete any active reasoning step before content starts
        if (currentReasoningStepId) {
          completeStep(currentReasoningStepId);
          currentReasoningStepId = null;
        }
        assistantMessage += delta.content;
        res.write(
          `data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`,
        );
      }

      if (delta.tool_calls) {
        // Complete any active reasoning step before tool calls
        if (currentReasoningStepId) {
          completeStep(currentReasoningStepId);
          currentReasoningStepId = null;
        }

        for (const toolCall of delta.tool_calls) {
          if (!toolCalls[toolCall.index]) {
            // New tool call starting
            toolCalls[toolCall.index] = {
              id: toolCall.id,
              type: "function",
              function: { name: "", arguments: "" },
            };

            // Start a new step for this tool call
            // We store the step ID on the toolCalls object itself to track it
            toolCalls[toolCall.index].stepId = startStep("tool_call", {
              tool_call_id: toolCall.id,
              tool_name: toolCall.function?.name || "",
              tool_arguments: ""
            });
          }

          if (toolCall.function?.name) {
            toolCalls[toolCall.index].function.name = toolCall.function.name;
            // Update step with name (use snake_case to match save code)
            const step = steps.find(s => s.id === toolCalls[toolCall.index].stepId);
            if (step) {
              step.tool_name = toolCalls[toolCall.index].function.name;
            }
          }

          if (toolCall.function?.arguments) {
            toolCalls[toolCall.index].function.arguments +=
              toolCall.function.arguments;

            // Update step with arguments (use snake_case to match save code)
            const step = steps.find(s => s.id === toolCalls[toolCall.index].stepId);
            if (step) {
              step.tool_arguments = toolCalls[toolCall.index].function.arguments;
              // For tool calls, we treat arguments as "content" for the step stream
              appendStepContent(step.id, toolCall.function.arguments);
            }
          }
        }
      }
    }

    // Complete any remaining reasoning step
    if (currentReasoningStepId) {
      completeStep(currentReasoningStepId);
      currentReasoningStepId = null;
    }

    // Complete any tool call steps
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        if (toolCall && toolCall.stepId) {
          completeStep(toolCall.stepId);
        }
      }
    }

    const responseTimeMs = Date.now() - requestStartTime;
    console.log(
      `Stream complete. Captured ${assistantReasoning.length} reasoning chars and ${assistantMessage.length} content chars. Time: ${responseTimeMs}ms`,
    );
    if (usageData) {
      console.log(`Usage: ${JSON.stringify(usageData)}`);
    }

    // Save initial assistant message
    // When tools are involved, this preserves the initial reasoning before tool execution
    if (assistantMessage || assistantReasoning || toolCalls.length > 0) {
      const hasTools = toolCalls.length > 0;
      db.prepare(
        `
        INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, prompt_tokens, completion_tokens, response_time_ms, model, cost, used_default_key, response_group_id)
        VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        currentAssistantMessageId,
        chatId,
        assistantMessage || "",
        assistantReasoning || null,
        hasTools ? JSON.stringify(toolCalls) : null,
        usageData?.prompt_tokens || null,
        usageData?.completion_tokens || null,
        responseTimeMs,
        chat.model,
        usageData?.cost || 0,
        usedDefaultKey ? 1 : 0,
        hasTools ? responseGroupId : null,
      );
      allAssistantMessageIds.push(currentAssistantMessageId);
    }

    // Update persistent user stats (survives message/chat deletion)
    const totalTokens = (usageData?.prompt_tokens || 0) + (usageData?.completion_tokens || 0);
    const cost = usageData?.cost || 0;
    const defaultKeyTokens = usedDefaultKey ? totalTokens : 0;
    const defaultKeyCost = usedDefaultKey ? cost : 0;
    const personalKeyTokens = usedDefaultKey ? 0 : totalTokens;
    const personalKeyCost = usedDefaultKey ? 0 : cost;

    try {
      db.prepare(
        `
        INSERT INTO user_stats (user_id, total_messages, total_prompt_tokens, total_completion_tokens, total_cost, total_reasoning_chars, default_key_tokens, default_key_cost, personal_key_tokens, personal_key_cost, updated_at)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          total_messages = total_messages + 1,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          total_cost = total_cost + ?,
          total_reasoning_chars = total_reasoning_chars + ?,
          default_key_tokens = default_key_tokens + ?,
          default_key_cost = default_key_cost + ?,
          personal_key_tokens = personal_key_tokens + ?,
          personal_key_cost = personal_key_cost + ?,
          updated_at = CURRENT_TIMESTAMP
      `,
      ).run(
        req.user.id,
        usageData?.prompt_tokens || 0,
        usageData?.completion_tokens || 0,
        cost,
        assistantReasoning?.length || 0,
        defaultKeyTokens,
        defaultKeyCost,
        personalKeyTokens,
        personalKeyCost,
        usageData?.prompt_tokens || 0,
        usageData?.completion_tokens || 0,
        cost,
        assistantReasoning?.length || 0,
        defaultKeyTokens,
        defaultKeyCost,
        personalKeyTokens,
        personalKeyCost,
      );
    } catch (statsError) {
      console.error(`Stats update failed:`, statsError);
    }

    // Update persistent per-model stats (survives message/chat deletion)
    if (chat.model) {
      db.prepare(
        `
        INSERT INTO user_model_stats (user_id, model, usage_count, total_prompt_tokens, total_completion_tokens, total_cost, updated_at)
        VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, model) DO UPDATE SET
          usage_count = usage_count + 1,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          total_cost = total_cost + ?,
          updated_at = CURRENT_TIMESTAMP
      `,
      ).run(
        req.user.id,
        chat.model,
        usageData?.prompt_tokens || 0,
        usageData?.completion_tokens || 0,
        usageData?.cost || 0,
        usageData?.prompt_tokens || 0,
        usageData?.completion_tokens || 0,
        usageData?.cost || 0,
      );
    }

    // Handle tool calls with a loop - model can call tools continuously
    let currentToolCalls = toolCalls;
    let conversationMessages = [...openaiMessages];
    let finalMessage = assistantMessage;
    let finalReasoning = assistantReasoning;
    let finalUsage = usageData;
    let totalResponseTime = responseTimeMs;

    while (currentToolCalls.length > 0) {
      res.write(
        `data: ${JSON.stringify({ type: "tool_calls", tool_calls: currentToolCalls })}\n\n`,
      );

      // Execute all tool calls and collect results (don't save to DB - internal only)
      const toolResults = [];
      for (const toolCall of currentToolCalls) {
        // Reuse the streaming step if it exists; otherwise create a new one
        let toolCallStepId;
        if (toolCall.stepId) {
          toolCallStepId = toolCall.stepId;
        } else {
          toolCallStepId = startStep("tool_call", {
            tool_call_id: toolCall.id,
            tool_name: toolCall.function.name,
            tool_arguments: toolCall.function.arguments
          });
        }

        const toolStartTime = Date.now();
        const result = await executeToolCall(toolCall, req.user.id, chat.workspace_id);
        const toolDuration = Date.now() - toolStartTime;

        // Complete the tool_call step
        completeStep(toolCallStepId);

        // Start and complete a tool_result step
        const toolResultStepId = startStep("tool_result", {
          tool_call_id: toolCall.id,
          tool_name: toolCall.function.name
        });
        appendStepContent(toolResultStepId, result);
        completeStep(toolResultStepId);

        toolResults.push({
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          result,
        });

        // Also send legacy event for backward compatibility
        res.write(
          `data: ${JSON.stringify({
            type: "tool_result",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            result: result
          })}\n\n`,
        );

        // Save tool result to database
        const toolMessageId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chat_id, role, content, tool_call_id, name, created_at, response_group_id)
          VALUES (?, ?, 'tool', ?, ?, ?, ?, ?)
        `).run(
          toolMessageId,
          chatId,
          result,
          toolCall.id,
          toolCall.function.name,
          new Date().toISOString(),
          responseGroupId
        );
      }

      // Build messages for follow-up: conversation so far + assistant tool call + tool results
      conversationMessages = [
        ...conversationMessages,
        {
          role: "assistant",
          content: finalMessage || null,
          tool_calls: currentToolCalls,
        },
        ...toolResults.map((tr) => ({
          role: "tool",
          tool_call_id: tr.tool_call_id,
          content: tr.result,
        })),
      ];

      console.log(`Making follow-up request to synthesize ${toolResults.length} tool result(s)`);

      // Follow-up request options - include tools so model can call more if needed
      const followUpOptions = {
        model: chat.model,
        messages: conversationMessages,
        temperature: chat.temperature,
        stream: true,
        usage: { include: true },
      };

      // Include tools so model can continue calling them
      const tools = db
        .prepare(
          `
        SELECT name, description, parameters
        FROM tools
        WHERE enabled = 1
      `,
        )
        .all();

      // Filter out workspace_search if not in a workspace
      const filteredTools = tools.filter(t =>
        t.name !== 'workspace_search' || chat.workspace_id
      );

      if (filteredTools.length > 0) {
        followUpOptions.tools = filteredTools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: JSON.parse(t.parameters),
          },
        }));
      }

      // Add reasoning configuration if enabled (OpenRouter format)
      if (reasoning) {
        followUpOptions.reasoning = reasoning;
      }

      // Emit new_assistant_turn event so the client can prepare for a new turn
      res.write(`data: ${JSON.stringify({
        type: "new_assistant_turn",
        turn_index: allAssistantMessageIds.length
      })}\n\n`);

      // Create new message ID for this synthesis turn
      currentAssistantMessageId = uuidv4();

      const synthesisStartTime = Date.now();
      const synthesisStream = await openai.chat.completions.create(followUpOptions);

      let synthesisMessage = "";
      let synthesisReasoning = "";
      let synthesisUsage = null;
      let synthesisToolCalls = [];
      let synthesisReasoningStepId = null;

      for await (const chunk of synthesisStream) {
        const delta = chunk.choices[0]?.delta;

        if (chunk.usage) {
          synthesisUsage = chunk.usage;
        }

        if (!delta) continue;

        const reasoning =
          delta.reasoning_content || delta.reasoning || delta.thought;

        if (reasoning) {
          // Start a new reasoning step for post-tool synthesis if not already active
          if (!synthesisReasoningStepId) {
            synthesisReasoningStepId = startStep("reasoning");
          }
          synthesisReasoning += reasoning;
          appendStepContent(synthesisReasoningStepId, reasoning);
          // Also send legacy event for backward compatibility
          res.write(
            `data: ${JSON.stringify({ type: "reasoning", content: reasoning })}\n\n`,
          );
        }

        if (delta.content) {
          // Complete any active reasoning step before content starts
          if (synthesisReasoningStepId) {
            completeStep(synthesisReasoningStepId);
            synthesisReasoningStepId = null;
          }
          synthesisMessage += delta.content;
          res.write(
            `data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`,
          );
        }

        // Check for more tool calls
        if (delta.tool_calls) {
          // Complete any active reasoning step before tool calls
          if (synthesisReasoningStepId) {
            completeStep(synthesisReasoningStepId);
            synthesisReasoningStepId = null;
          }

          for (const toolCall of delta.tool_calls) {
            if (!synthesisToolCalls[toolCall.index]) {
              synthesisToolCalls[toolCall.index] = {
                id: toolCall.id,
                type: "function",
                function: { name: "", arguments: "" },
              };
              // Create step for this synthesis tool call
              synthesisToolCalls[toolCall.index].stepId = startStep("tool_call", {
                tool_call_id: toolCall.id,
                tool_name: toolCall.function?.name || "",
                tool_arguments: ""
              });
            }

            if (toolCall.function?.name) {
              synthesisToolCalls[toolCall.index].function.name = toolCall.function.name;
              const step = steps.find(s => s.id === synthesisToolCalls[toolCall.index].stepId);
              if (step) step.tool_name = synthesisToolCalls[toolCall.index].function.name;
            }

            if (toolCall.function?.arguments) {
              synthesisToolCalls[toolCall.index].function.arguments +=
                toolCall.function.arguments;
              const step = steps.find(s => s.id === synthesisToolCalls[toolCall.index].stepId);
              if (step) {
                step.tool_arguments = synthesisToolCalls[toolCall.index].function.arguments;
                appendStepContent(step.id, toolCall.function.arguments);
              }
            }
          }
        }
      }

      // Complete any remaining reasoning step
      if (synthesisReasoningStepId) {
        completeStep(synthesisReasoningStepId);
        synthesisReasoningStepId = null;
      }

      // Complete any synthesis tool call steps
      if (synthesisToolCalls.length > 0) {
        for (const toolCall of synthesisToolCalls) {
          if (toolCall && toolCall.stepId) {
            completeStep(toolCall.stepId);
          }
        }
      }

      const synthesisTimeMs = Date.now() - synthesisStartTime;
      totalResponseTime += synthesisTimeMs;
      console.log(
        `Synthesis complete. ${synthesisMessage.length} content chars, ${synthesisReasoning.length} reasoning chars, ${synthesisToolCalls.length} tool calls in ${synthesisTimeMs}ms`,
      );

      // INSERT a new assistant message for this synthesis turn (instead of updating the original)
      const hasSynthToolCalls = synthesisToolCalls.filter(tc => tc && tc.function.name).length > 0;
      db.prepare(
        `
        INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, prompt_tokens, completion_tokens, response_time_ms, model, cost, used_default_key, response_group_id)
        VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        currentAssistantMessageId,
        chatId,
        synthesisMessage || "",
        synthesisReasoning || null,
        hasSynthToolCalls ? JSON.stringify(synthesisToolCalls.filter(tc => tc && tc.function.name)) : null,
        synthesisUsage?.prompt_tokens || null,
        synthesisUsage?.completion_tokens || null,
        synthesisTimeMs,
        chat.model,
        synthesisUsage?.cost || 0,
        usedDefaultKey ? 1 : 0,
        responseGroupId,
      );
      allAssistantMessageIds.push(currentAssistantMessageId);

      // Update stats for synthesis response
      const synthTokens = (synthesisUsage?.prompt_tokens || 0) + (synthesisUsage?.completion_tokens || 0);
      const synthCost = synthesisUsage?.cost || 0;

      try {
        db.prepare(
          `
          INSERT INTO user_stats (user_id, total_messages, total_prompt_tokens, total_completion_tokens, total_cost, total_reasoning_chars, default_key_tokens, default_key_cost, personal_key_tokens, personal_key_cost, updated_at)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            total_messages = total_messages + 1,
            total_prompt_tokens = total_prompt_tokens + ?,
            total_completion_tokens = total_completion_tokens + ?,
            total_cost = total_cost + ?,
            total_reasoning_chars = total_reasoning_chars + ?,
            default_key_tokens = default_key_tokens + ?,
            default_key_cost = default_key_cost + ?,
            personal_key_tokens = personal_key_tokens + ?,
            personal_key_cost = personal_key_cost + ?,
            updated_at = CURRENT_TIMESTAMP
        `,
        ).run(
          req.user.id,
          synthesisUsage?.prompt_tokens || 0,
          synthesisUsage?.completion_tokens || 0,
          synthCost,
          synthesisReasoning?.length || 0,
          usedDefaultKey ? synthTokens : 0,
          usedDefaultKey ? synthCost : 0,
          usedDefaultKey ? 0 : synthTokens,
          usedDefaultKey ? 0 : synthCost,
          synthesisUsage?.prompt_tokens || 0,
          synthesisUsage?.completion_tokens || 0,
          synthCost,
          synthesisReasoning?.length || 0,
          usedDefaultKey ? synthTokens : 0,
          usedDefaultKey ? synthCost : 0,
          usedDefaultKey ? 0 : synthTokens,
          usedDefaultKey ? 0 : synthCost,
        );
      } catch (statsError) {
        console.error(`Stats update failed:`, statsError);
      }

      // Update model stats for synthesis
      if (chat.model) {
        db.prepare(
          `
          INSERT INTO user_model_stats (user_id, model, usage_count, total_prompt_tokens, total_completion_tokens, total_cost, updated_at)
          VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, model) DO UPDATE SET
            usage_count = usage_count + 1,
            total_prompt_tokens = total_prompt_tokens + ?,
            total_completion_tokens = total_completion_tokens + ?,
            total_cost = total_cost + ?,
            updated_at = CURRENT_TIMESTAMP
        `,
        ).run(
          req.user.id,
          chat.model,
          synthesisUsage?.prompt_tokens || 0,
          synthesisUsage?.completion_tokens || 0,
          synthesisUsage?.cost || 0,
          synthesisUsage?.prompt_tokens || 0,
          synthesisUsage?.completion_tokens || 0,
          synthesisUsage?.cost || 0,
        );
      }

      // Update for next iteration context (keep finalMessage for conversationMessages only)
      finalMessage = synthesisMessage;
      finalReasoning = synthesisReasoning;
      finalUsage = synthesisUsage;
      currentToolCalls = synthesisToolCalls.filter(tc => tc && tc.function.name);
    }

    // Update chat timestamp
    db.prepare(
      `
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `,
    ).run(chatId);

    // Save all steps to the database, each associated with its own message
    if (steps.length > 0) {
      const insertStep = db.prepare(`
        INSERT INTO message_steps (id, message_id, chat_id, step_type, step_index, content, tool_call_id, tool_name, tool_arguments, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const step of steps) {
        insertStep.run(
          step.id,
          step.messageId || allAssistantMessageIds[0] || currentAssistantMessageId,
          chatId,
          step.type,
          step.index,
          step.content || null,
          step.tool_call_id || null,
          step.tool_name || null,
          step.tool_arguments || null,
          step.duration_ms || null,
          new Date().toISOString()
        );
      }
    }

    // Send final message ID(s) to client for optimistic update
    const lastMessageId = allAssistantMessageIds.length > 0
      ? allAssistantMessageIds[allAssistantMessageIds.length - 1]
      : currentAssistantMessageId;

    res.write(`data: ${JSON.stringify({
      type: "message_finalized",
      message_id: lastMessageId,
      message_ids: allAssistantMessageIds,
      response_group_id: allAssistantMessageIds.length > 1 ? responseGroupId : null
    })}\n\n`);

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        message_id: lastMessageId,
        message_ids: allAssistantMessageIds,
        usage: finalUsage || usageData || null,
        model: chat.model,
        cost: finalUsage?.cost || usageData?.cost || 0,
      })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error("Message error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: error.message || "Failed to process message" });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`,
      );
      res.end();
    }
  }
});

// Get messages for a chat
router.get("/:chatId", (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify chat ownership
    const chat = db
      .prepare(
        `
      SELECT id FROM chats WHERE id = ? AND user_id = ?
    `,
      )
      .get(chatId, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const messages = db
      .prepare(
        `
      SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC
    `,
      )
      .all(chatId);

    // Fetch steps for all messages in this chat
    const allSteps = db
      .prepare(
        `
      SELECT * FROM message_steps WHERE chat_id = ? ORDER BY step_index ASC
    `,
      )
      .all(chatId);

    // Group steps by message_id
    const stepsByMessage = {};
    for (const step of allSteps) {
      if (!stepsByMessage[step.message_id]) {
        stepsByMessage[step.message_id] = [];
      }
      stepsByMessage[step.message_id].push(step);
    }

    // Attach steps to their respective messages
    const messagesWithSteps = messages.map(msg => ({
      ...msg,
      steps: stepsByMessage[msg.id] || []
    }));

    res.json(messagesWithSteps);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Delete message and all subsequent messages (branch)
router.delete("/:messageId/branch", async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get the message to find its chat_id and created_at
    const message = db
      .prepare(
        `
      SELECT m.* FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.id = ? AND c.user_id = ?
    `,
      )
      .get(messageId, req.user.id);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Delete this message and all subsequent messages in the same chat
    db.prepare(
      `
      DELETE FROM messages
      WHERE chat_id = ? AND created_at >= ?
    `,
    ).run(message.chat_id, message.created_at);

    // Update chat timestamp
    db.prepare(
      `
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `,
    ).run(message.chat_id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete branch error:", error);
    res.status(500).json({ error: "Failed to delete message branch" });
  }
});

export default router;
