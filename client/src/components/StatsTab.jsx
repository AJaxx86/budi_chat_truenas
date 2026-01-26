import React, { useState, useEffect } from "react";
import { BarChart2, Zap, Coins, Hash, Calendar, Check } from "lucide-react";

// Get the Monday of the current week
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Get array of weekdays (Mon-Fri) with their dates
const getWeekDays = () => {
  const monday = getWeekStart();
  const days = ["M", "T", "W", "T", "F"];
  return days.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      label,
      date: date.toISOString().split("T")[0],
      dayIndex: index,
    };
  });
};

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animatingDay, setAnimatingDay] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setError(null);
      const res = await fetch("/api/stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load statistics");
      }

      const data = await res.json();
      setStats(data);

      // Check if today has activity and trigger animation
      const today = new Date().toISOString().split("T")[0];
      const todayActivity = data.week_activity?.find((a) => a.date === today);
      if (todayActivity && todayActivity.message_count > 0) {
        setAnimatingDay(today);
        // Clear animation after it plays
        setTimeout(() => setAnimatingDay(null), 2000);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 mb-2">Failed to load statistics</div>
        <button
          onClick={loadStats}
          className="text-accent hover:text-accent-light text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  // Default stats structure for empty state
  const totals = stats?.totals || {
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost: 0,
    messages: 0,
    avg_response_time_ms: 0,
  };

  const topModels = stats?.top_models || [];
  const weekActivity = stats?.week_activity || [];
  const maxTokens = topModels.length > 0 ? topModels[0].total_tokens : 1;

  // Build week data with activity
  const weekDays = getWeekDays();
  const today = new Date().toISOString().split("T")[0];

  const weekData = weekDays.map((day) => {
    const activity = weekActivity.find((a) => a.date === day.date);
    const isPast = day.date < today;
    const isToday = day.date === today;
    const isFuture = day.date > today;
    const hasActivity = activity && activity.message_count > 0;

    return {
      ...day,
      messageCount: activity?.message_count || 0,
      hasActivity,
      isPast,
      isToday,
      isFuture,
      isAnimating: animatingDay === day.date,
    };
  });

  // Calculate progress percentage (how many days with activity out of days up to today)
  const daysUpToToday = weekData.filter((d) => !d.isFuture).length;
  const activeDays = weekData.filter(
    (d) => d.hasActivity && !d.isFuture,
  ).length;
  const progressPercent =
    daysUpToToday > 0 ? (activeDays / daysUpToToday) * 100 : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-dark-100 mb-2">
        Usage Statistics
      </h2>
      <p className="text-dark-400 mb-6">
        Your lifetime usage and weekly activity
      </p>

      {/* Weekly Activity Calendar */}
      <div className="bg-dark-800/30 rounded-xl p-6 border border-dark-700/30 mb-8">
        <h3 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent-400" />
          Weekly Activity
        </h3>

        {/* Day circles with connecting bars */}
        <div className="flex items-center justify-center px-4">
          {weekData.map((day, index) => (
            <React.Fragment key={day.date}>
              {/* Day circle with label */}
              <div className="flex flex-col items-center group relative">
                {/* Day circle */}
                <div
                  className={`
                    relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm
                    transition-all duration-300 cursor-default
                    ${day.hasActivity
                      ? "bg-gradient-to-br from-accent to-accent-light text-white shadow-lg shadow-accent/30"
                      : day.isToday
                        ? "bg-dark-700 border-2 border-accent/50 text-dark-300"
                        : day.isFuture
                          ? "bg-dark-800/50 border border-dark-700 text-dark-600"
                          : "bg-dark-700 border border-dark-600 text-dark-400"
                    }
                    ${day.isAnimating ? "animate-pulse ring-4 ring-accent/50 scale-110" : ""}
                  `}
                >
                  {day.hasActivity ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{day.label}</span>
                  )}

                  {/* Today indicator dot */}
                  {day.isToday && !day.hasActivity && (
                    <div className="absolute -bottom-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
                  )}
                </div>

                {/* Day label below */}
                <span
                  className={`mt-2 text-xs font-medium ${day.hasActivity
                      ? "text-accent"
                      : day.isToday
                        ? "text-dark-300"
                        : "text-dark-600"
                    }`}
                >
                  {day.label}
                </span>

                {/* Hover tooltip */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                    <div className="text-dark-300 font-medium">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div
                      className={`font-semibold ${day.hasActivity ? "text-accent" : "text-dark-500"}`}
                    >
                      {day.messageCount} message
                      {day.messageCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {/* Tooltip arrow */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-dark-800 border-r border-b border-dark-600 rotate-45" />
                </div>
              </div>

              {/* Connecting bar (except after last circle) */}
              {index < weekData.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-1 rounded-full self-start mt-[22px] min-w-[40px] ${day.hasActivity && weekData[index + 1].hasActivity
                      ? "bg-gradient-to-r from-accent to-accent-light"
                      : day.hasActivity || weekData[index + 1].hasActivity
                        ? "bg-gradient-to-r from-accent/30 to-accent-light/30"
                        : "bg-dark-700"
                    }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Streak message */}
        <div className="mt-6 text-center">
          {activeDays === 5 ? (
            <span className="text-accent font-medium">
              Perfect week! Keep it up!
            </span>
          ) : activeDays > 0 ? (
            <span className="text-dark-400">
              {activeDays} of {daysUpToToday} day
              {daysUpToToday !== 1 ? "s" : ""} active this week
            </span>
          ) : (
            <span className="text-dark-500">
              Send a message to start your streak!
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-dark-800/50 p-6 rounded-xl border border-dark-700/50">
          <div className="flex items-center gap-2 text-dark-400 mb-2 text-sm">
            <Zap className="w-4 h-4" />
            Lifetime Tokens
          </div>
          <div className="text-3xl font-bold text-dark-100 mb-1">
            {totals.total_tokens.toLocaleString()}
          </div>
          <div className="text-sm text-dark-500">
            {totals.prompt_tokens.toLocaleString()} input /{" "}
            {totals.completion_tokens.toLocaleString()} output
          </div>
        </div>

        <div className="bg-dark-800/50 p-6 rounded-xl border border-dark-700/50">
          <div className="flex items-center gap-2 text-dark-400 mb-2 text-sm">
            <Coins className="w-4 h-4" />
            Lifetime Cost
          </div>
          <div className="text-3xl font-bold text-dark-100 mb-1">
            ${totals.cost.toFixed(4)}
          </div>
          <div className="text-sm text-dark-500">Based on model pricing</div>
        </div>
      </div>

      {/* Top 3 Models */}
      <div className="bg-dark-800/30 rounded-xl p-6 border border-dark-700/30">
        <h3 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-accent" />
          Top 3 Models by Token Usage
        </h3>

        {topModels.length === 0 ? (
          <div className="text-center py-8 text-dark-500">
            No model usage data yet. Start chatting to see your stats!
          </div>
        ) : (
          <div className="space-y-4">
            {topModels.slice(0, 3).map((model, idx) => (
              <div key={model.model} className="group">
                <div className="flex items-start gap-4">
                  <div
                    className={`text-2xl font-bold w-8 shrink-0 ${idx === 0
                        ? "text-yellow-400"
                        : idx === 1
                          ? "text-dark-400"
                          : "text-amber-700"
                      }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="truncate text-dark-100 font-medium pr-4">
                        {model.model}
                      </div>
                      <div className="text-accent font-semibold whitespace-nowrap">
                        {model.total_tokens.toLocaleString()} tokens
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-500 mb-3">
                      <span>
                        {model.total_prompt_tokens.toLocaleString()} input
                      </span>
                      <span>
                        {model.total_completion_tokens.toLocaleString()} output
                      </span>
                      <span>{model.usage_count} messages</span>
                      {model.total_cost > 0 && (
                        <span>${model.total_cost.toFixed(4)}</span>
                      )}
                    </div>

                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full transition-all duration-500"
                        style={{
                          width: `${(model.total_tokens / maxTokens) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-dark-800/30 p-4 rounded-lg border border-dark-700/30">
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
            <Hash className="w-4 h-4" />
            Total Messages
          </div>
          <div className="text-xl font-bold text-dark-200">
            {totals.messages.toLocaleString()}
          </div>
        </div>

        <div className="bg-dark-800/30 p-4 rounded-lg border border-dark-700/30">
          <div className="text-dark-400 text-sm mb-1">Avg Response Time</div>
          <div className="text-xl font-bold text-dark-200">
            {totals.avg_response_time_ms}ms
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsTab;
