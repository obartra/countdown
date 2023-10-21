document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const endtime = urlParams.get("time");
  const params = {
    title: urlParams.get("title"),
    description: urlParams.get("description"),
    footer: urlParams.get("footer"),
    bgColor: urlParams.get("bgcolor"),
    textColor: urlParams.get("color"),
  };

  if (!endtime) {
    console.error("No endtime parameter provided in the URL.");
    return;
  }

  const getRemainingTime = (endtime) => {
    const total = Date.parse(endtime) - Date.parse(new Date());

    if (isNaN(total)) {
      alert(`Invalid endtime provided: ${JSON.stringify(endtime)}`);
      return {};
    }

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const years = days > 365 ? Math.floor(days / 365) : 0;

    return {
      total,
      years,
      days: days > 365 ? days % 365 : days,
      hours,
      minutes,
      seconds,
    };
  };

  const initializeClock = (endtime) => {
    const display = document.getElementById("countdown");

    const updateClock = () => {
      const t = getRemainingTime(endtime);

      if (t.total <= 0) {
        clearInterval(timeInterval);
        alert("Time's up!");
        return;
      }

      let timeStr = "";
      if (t.years) timeStr += t.years + " years ";
      if (t.days) timeStr += t.days + " days ";
      if (t.hours) timeStr += t.hours + " hours ";
      if (t.minutes) timeStr += t.minutes + " minutes ";
      timeStr += t.seconds + " seconds";

      display.innerHTML = timeStr;
      document.title = `${endtime ? endtime + " - " : ""} ${timeStr} remaining`;
    };

    updateClock();
    const timeInterval = setInterval(updateClock, 1000);
  };

  // Extract date, time, and timezone information
  const endDate = new Date(endtime);
  const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  const formattedDate = endDate.toLocaleDateString(userLocale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Update message placeholder with extracted info
  document.getElementById("endtime-date").textContent = formattedDate;
  document.getElementById(
    "endtime-timezone"
  ).textContent = ` ${userTimeZone} time`;

  document.getElementById("page-title").textContent = params.title;
  document.getElementById("page-description").textContent = params.description;
  document.getElementById("page-footer").textContent = params.footer;

  document.body.style.backgroundColor = params.bgColor;
  document.body.style.color = params.textColor;

  initializeClock(endtime);
});
