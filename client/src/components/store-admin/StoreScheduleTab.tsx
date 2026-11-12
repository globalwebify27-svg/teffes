"use client";

import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

interface SpecialSchedule {
  date: string; // YYYY-MM-DD
  mode: "half_day" | "late_opening" | "custom_hours" | "closed";
  openTime?: string; // HH:MM
  closeTime?: string; // HH:MM
  customerNote?: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface StoreScheduleTabProps {
  storeId?: string;
  storeName?: string;
}

export default function StoreScheduleTab({
  storeId = "S001",
  storeName = "Kishore Ganj Store",
}: StoreScheduleTabProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [normalTimings, setNormalTimings] = useState<string>("08:00 AM - 08:00 PM");
  const [todayIST, setTodayIST] = useState<string>("");
  const [todaySchedule, setTodaySchedule] = useState<SpecialSchedule | null>(null);
  const [upcomingSchedules, setUpcomingSchedules] = useState<SpecialSchedule[]>([]);

  // Form State
  const [datePreset, setDatePreset] = useState<"today" | "tomorrow" | "custom">("today");
  const [targetDate, setTargetDate] = useState<string>("");
  const [mode, setMode] = useState<"half_day" | "late_opening" | "custom_hours" | "closed">("half_day");
  const [openTime, setOpenTime] = useState<string>("08:00");
  const [closeTime, setCloseTime] = useState<string>("13:00");
  const [customerNote, setCustomerNote] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Compute Tomorrow's date string
  const getTomorrowString = (todayStr: string) => {
    if (!todayStr) return "";
    const [y, m, d] = todayStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  };

  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const res = await api.get("/store-admin/schedule", {
        params: { storeId },
      });
      if (res.data?.success) {
        setNormalTimings(res.data.normalTimings || "08:00 AM - 08:00 PM");
        setTodayIST(res.data.todayIST || "");
        setTodaySchedule(res.data.todaySchedule || null);
        setUpcomingSchedules(res.data.upcomingSchedules || []);

        if (!targetDate) {
          setTargetDate(res.data.todayIST || "");
        }
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      console.error("Failed to load schedules:", error);
      toast.error(error.response?.data?.message || "Failed to load store operating schedule");
    } finally {
      setIsLoading(false);
    }
  }, [storeId, targetDate]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Handle Preset Changes
  const handleDatePreset = (preset: "today" | "tomorrow" | "custom") => {
    setDatePreset(preset);
    if (preset === "today") {
      setTargetDate(todayIST);
    } else if (preset === "tomorrow") {
      setTargetDate(getTomorrowString(todayIST));
    }
  };

  // Pre-fill form for editing
  const handleStartEdit = (sch: SpecialSchedule) => {
    setIsEditing(true);
    setTargetDate(sch.date);
    setMode(sch.mode);
    setOpenTime(sch.openTime || "08:00");
    setCloseTime(sch.closeTime || "13:00");
    setCustomerNote(sch.customerNote || "");
    setErrorMessage("");

    if (sch.date === todayIST) {
      setDatePreset("today");
    } else if (sch.date === getTomorrowString(todayIST)) {
      setDatePreset("tomorrow");
    } else {
      setDatePreset("custom");
    }

    // Scroll smoothly to form
    const formElem = document.getElementById("schedule-config-form");
    if (formElem) {
      formElem.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Reset Form
  const handleResetForm = () => {
    setIsEditing(false);
    setDatePreset("today");
    setTargetDate(todayIST);
    setMode("half_day");
    setOpenTime("08:00");
    setCloseTime("13:00");
    setCustomerNote("");
    setErrorMessage("");
  };

  // Save Schedule Handler
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) {
      setErrorMessage("Please select a valid date");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      const payload = {
        storeId,
        date: targetDate,
        mode,
        openTime: mode === "late_opening" || mode === "custom_hours" ? openTime : "08:00",
        closeTime: mode === "half_day" || mode === "custom_hours" ? closeTime : "20:00",
        customerNote: customerNote.trim(),
      };

      const res = await api.post("/store-admin/schedule", payload);
      if (res.data?.success) {
        toast.success(
          `Operating schedule for ${targetDate} saved successfully!`,
          "Schedule Updated"
        );
        handleResetForm();
        await fetchSchedules();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error.response?.data?.message || "Failed to update operating schedule";
      setErrorMessage(msg);
      toast.error(msg, "Schedule Conflict");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete / Revert Schedule Handler
  const handleDeleteSchedule = async (dateStr: string) => {
    if (!confirm(`Are you sure you want to remove the special schedule for ${dateStr}? The store will revert to standard operating hours.`)) {
      return;
    }

    try {
      setDeletingDate(dateStr);
      const res = await api.delete(`/store-admin/schedule/${dateStr}`, {
        params: { storeId },
      });
      if (res.data?.success) {
        toast.success(
          `Special schedule for ${dateStr} removed. Store returned to normal hours.`,
          "Schedule Removed"
        );
        if (targetDate === dateStr && isEditing) {
          handleResetForm();
        }
        await fetchSchedules();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "Failed to remove special schedule");
    } finally {
      setDeletingDate(null);
    }
  };

  // Helper formatting for 24-hr to 12-hr display
  const formatTime12 = (time24?: string) => {
    if (!time24) return "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
  };

  // Helper formatting for date
  const formatDateDisplay = (dateStr: string) => {
    if (dateStr === todayIST) return "Today";
    if (dateStr === getTomorrowString(todayIST)) return "Tomorrow";
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ─── 1. TOP LIVE STATUS HERO CARD ─── */}
      <div className="bg-white rounded-2xl border border-[#ede8e0] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#941717]">
                store
              </span>
              <h2 className="text-base font-extrabold text-[#171410] tracking-tight">
                {storeName} &mdash; Operating Schedule
              </h2>
            </div>
            <p className="text-xs text-[#73695b] mt-1">
              Standard Operating Hours:{" "}
              <span className="font-bold text-[#171410]">{normalTimings}</span> &bull; Current IST Date:{" "}
              <span className="font-bold text-[#171410]">{todayIST || "Loading..."}</span>
            </p>
          </div>

          {/* Today's Live Active Badge */}
          <div className="flex items-center gap-2">
            {todaySchedule ? (
              <div
                className={`px-3.5 py-2 rounded-xl border flex items-center gap-2.5 ${
                  todaySchedule.mode === "closed"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : todaySchedule.mode === "half_day"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-sky-50 border-sky-200 text-sky-900"
                }`}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  {todaySchedule.mode === "closed"
                    ? "cancel"
                    : todaySchedule.mode === "half_day"
                    ? "hourglass_bottom"
                    : "schedule"}
                </span>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">
                    Today:{" "}
                    {todaySchedule.mode === "closed"
                      ? "Full-Day Closed"
                      : todaySchedule.mode === "half_day"
                      ? `Half-Day (Closes ${formatTime12(todaySchedule.closeTime)})`
                      : todaySchedule.mode === "late_opening"
                      ? `Late Opening (${formatTime12(todaySchedule.openTime)} - ${formatTime12(todaySchedule.closeTime)})`
                      : `Custom (${formatTime12(todaySchedule.openTime)} - ${formatTime12(todaySchedule.closeTime)})`}
                  </div>
                  {todaySchedule.customerNote && (
                    <div className="text-[11px] font-medium opacity-90 line-clamp-1">
                      {todaySchedule.customerNote}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-700">
                  check_circle
                </span>
                <span className="text-xs font-bold">Standard Hours Active Today ({normalTimings})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. TWO-COLUMN LAYOUT: CONFIGURATION FORM & UPCOMING SCHEDULES ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (5 cols): FORM */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#ede8e0] p-5 shadow-xs" id="schedule-config-form">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#941717]">
                tune
              </span>
              <h3 className="font-extrabold text-sm text-[#171410]">
                {isEditing ? `Edit Schedule (${targetDate})` : "Configure Special Hours"}
              </h3>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-gray-500 hover:text-gray-800 font-bold underline cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Conflict Error Message if any */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0 text-rose-700 mt-0.5">
                warning
              </span>
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            {/* Step 1: Select Target Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                1. Select Target Date
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDatePreset("today")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    datePreset === "today"
                      ? "border-[#941717] bg-red-50/70 text-[#941717] ring-1 ring-[#941717]/25"
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset("tomorrow")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    datePreset === "tomorrow"
                      ? "border-[#941717] bg-red-50/70 text-[#941717] ring-1 ring-[#941717]/25"
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePreset("custom")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    datePreset === "custom"
                      ? "border-[#941717] bg-red-50/70 text-[#941717] ring-1 ring-[#941717]/25"
                      : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  Pick Date
                </button>
              </div>

              {/* Custom Date Input */}
              {datePreset === "custom" && (
                <div className="mt-2.5">
                  <input
                    type="date"
                    min={todayIST}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl focus:outline-none focus:border-primary text-gray-900 bg-white shadow-2xs"
                  />
                </div>
              )}
            </div>

            {/* Step 2: Select Schedule Mode */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                2. Operating Situation
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Half-Day */}
                <div
                  onClick={() => setMode("half_day")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    mode === "half_day"
                      ? "border-[#941717] bg-red-50/60 ring-1 ring-[#941717]/25"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                    <span className="material-symbols-outlined text-[17px] text-amber-600">
                      hourglass_bottom
                    </span>
                    <span>Half-Day</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">
                    Closes early. Shifts later orders to next-day 9 AM.
                  </p>
                </div>

                {/* Late Opening */}
                <div
                  onClick={() => setMode("late_opening")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    mode === "late_opening"
                      ? "border-[#941717] bg-red-50/60 ring-1 ring-[#941717]/25"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                    <span className="material-symbols-outlined text-[17px] text-sky-600">
                      schedule
                    </span>
                    <span>Late Opening</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">
                    Opens after morning. Deliveries begin after open.
                  </p>
                </div>

                {/* Custom Hours */}
                <div
                  onClick={() => setMode("custom_hours")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    mode === "custom_hours"
                      ? "border-[#941717] bg-red-50/60 ring-1 ring-[#941717]/25"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                    <span className="material-symbols-outlined text-[17px] text-purple-600">
                      timelapse
                    </span>
                    <span>Custom Window</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">
                    Set specific start &amp; end operational times.
                  </p>
                </div>

                {/* Full-Day Closed */}
                <div
                  onClick={() => setMode("closed")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    mode === "closed"
                      ? "border-rose-600 bg-rose-50/60 ring-1 ring-rose-600/25"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-900">
                    <span className="material-symbols-outlined text-[17px] text-rose-600">
                      do_not_disturb_on
                    </span>
                    <span>Closed All Day</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">
                    Holiday / Full maintenance. No same-day orders.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Timings Selector (unless mode is closed) */}
            {mode !== "closed" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  3. Operational Hours
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Open Time */}
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 block mb-1">
                      Store Opens At:
                    </span>
                    <select
                      value={openTime}
                      disabled={mode === "half_day"}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className={`w-full px-2.5 py-1.5 text-xs font-bold border rounded-xl outline-none focus:border-primary ${
                        mode === "half_day"
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-900 border-gray-200 cursor-pointer"
                      }`}
                    >
                      <option value="08:00">08:00 AM (Normal)</option>
                      <option value="09:00">09:00 AM</option>
                      <option value="10:00">10:00 AM</option>
                      <option value="11:00">11:00 AM</option>
                      <option value="12:00">12:00 PM (Noon)</option>
                      <option value="13:00">01:00 PM</option>
                      <option value="14:00">02:00 PM</option>
                      <option value="15:00">03:00 PM</option>
                    </select>
                  </div>

                  {/* Close Time */}
                  <div>
                    <span className="text-[11px] font-bold text-gray-500 block mb-1">
                      Store Closes At:
                    </span>
                    <select
                      value={closeTime}
                      disabled={mode === "late_opening"}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className={`w-full px-2.5 py-1.5 text-xs font-bold border rounded-xl outline-none focus:border-primary ${
                        mode === "late_opening"
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-900 border-gray-200 cursor-pointer"
                      }`}
                    >
                      <option value="12:00">12:00 PM</option>
                      <option value="13:00">01:00 PM</option>
                      <option value="14:00">02:00 PM</option>
                      <option value="15:00">03:00 PM</option>
                      <option value="16:00">04:00 PM</option>
                      <option value="17:00">05:00 PM</option>
                      <option value="18:00">06:00 PM</option>
                      <option value="19:00">07:00 PM</option>
                      <option value="20:00">08:00 PM (Normal)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Customer Announcement Note */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                4. Customer Notice / Reason (Optional)
              </label>
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="e.g. Operating today until 1:00 PM. Later orders deliver tomorrow 9 AM."
                className="w-full px-3 py-2 text-xs font-medium border border-gray-200 rounded-xl focus:outline-none focus:border-primary text-gray-900 placeholder:text-gray-400"
              />
              <p className="text-[10.5px] text-gray-500 mt-1">
                Visible to customers in the cart drawer &amp; delivery speed banner.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#941717] hover:bg-[#7a1313] text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying &amp; Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">
                      save
                    </span>
                    <span>{isEditing ? "Update Special Schedule" : "Apply Special Schedule"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN (7 cols): SCHEDULE LIST & OVERVIEW */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-[#ede8e0] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#941717]">
                  event_upcoming
                </span>
                <h3 className="font-extrabold text-sm text-[#171410]">
                  Active &amp; Upcoming Special Schedules
                </h3>
              </div>
              <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {upcomingSchedules.length} Scheduled
              </span>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading operating schedules...</span>
              </div>
            ) : upcomingSchedules.length === 0 ? (
              <div className="py-10 text-center text-gray-500">
                <span className="material-symbols-outlined text-[36px] text-gray-300 block mb-2">
                  event_available
                </span>
                <p className="text-xs font-bold text-gray-700">No Special Schedules Configured</p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                  {storeName} is operating on standard daily timings ({normalTimings}). Use the form on the left to set half-days or late openings.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingSchedules.map((sch) => {
                  const isToday = sch.date === todayIST;
                  const isDeleting = deletingDate === sch.date;

                  return (
                    <div
                      key={sch.date}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isToday
                          ? "border-amber-300 bg-amber-50/40 shadow-xs"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs text-gray-900">
                              {formatDateDisplay(sch.date)} ({sch.date})
                            </span>
                            {isToday && (
                              <span className="text-[9.5px] uppercase font-black px-1.5 py-0.5 bg-amber-600 text-white rounded-md">
                                Live Today
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                sch.mode === "closed"
                                  ? "bg-rose-100 text-rose-800"
                                  : sch.mode === "half_day"
                                  ? "bg-amber-100 text-amber-800"
                                  : sch.mode === "late_opening"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {sch.mode === "closed"
                                ? "Closed"
                                : sch.mode === "half_day"
                                ? "Half-Day"
                                : sch.mode === "late_opening"
                                ? "Late Opening"
                                : "Custom Window"}
                            </span>
                          </div>

                          {/* Timings */}
                          <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-gray-400">
                              schedule
                            </span>
                            <span>
                              {sch.mode === "closed"
                                ? "Closed all day"
                                : `${formatTime12(sch.openTime)} &mdash; ${formatTime12(sch.closeTime)}`}
                            </span>
                          </div>

                          {/* Customer Note */}
                          {sch.customerNote && (
                            <p className="text-[11px] text-gray-600 italic">
                              &ldquo;{sch.customerNote}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Action Buttons: Edit and Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(sch)}
                            title="Edit this schedule"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              edit
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteSchedule(sch.date)}
                            title="Remove schedule & return to normal"
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <span className="inline-block w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">
                                delete
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Help / Business Rules Info Card */}
          <div className="bg-[#fcfaf7] rounded-2xl border border-[#ede8e0] p-4 text-xs text-[#73695b] space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#171410]">
              <span className="material-symbols-outlined text-[17px] text-[#941717]">
                info
              </span>
              <span>Operating Schedule Guidelines</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>
                <strong>Same-Day &amp; Advance Planning:</strong> You can apply a special schedule for today right now or schedule upcoming dates in advance.
              </li>
              <li>
                <strong>Active Order Protection:</strong> The system automatically prevents setting closing times earlier than currently pending active orders.
              </li>
              <li>
                <strong>Customer Transparency:</strong> When cutoff passes, customers ordering online see next-day 9 AM delivery automatically.
              </li>
              <li>
                <strong>Automatic Midnight Reset:</strong> Schedules expire automatically when the date ends without requiring manual deletion.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
