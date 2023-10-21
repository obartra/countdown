function contrastColor([r, g, b]) {
  let d = 0;

  // Counting the perceptive luminance - human eye favors green color...
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (luminance > 0.5) {
    return "black";
  }
  return "white";
}

const formatColorName = (colorName) =>
  // Regular expression to check if it's a valid 3 or 6 character hex color
  /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(colorName)
    ? `#${colorName}`
    : colorName;

function getRGBFromColorName(colorName) {
  // Create an off-screen canvas
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const ctx = canvas.getContext("2d");

  // Fill the canvas with the color name
  ctx.fillStyle = colorName;
  ctx.fillRect(0, 0, 1, 1);

  // Get the pixel data from the canvas
  return ctx.getImageData(0, 0, 1, 1).data;
}

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const endtime = urlParams.get("time");
  const params = {
    title: urlParams.get("title"),
    description: urlParams.get("description"),
    footer: urlParams.get("footer"),
    bgColor: formatColorName(urlParams.get("bgcolor")),
    textColor: formatColorName(urlParams.get("color")),
    image: urlParams.get("image"),
    completeText: urlParams.get("complete") || "Time is up!",
  };

  if (params.bgColor && !params.textColor) {
    params.textColor = contrastColor(getRGBFromColorName(params.bgColor));
  } else if (!params.bgColor && params.textColor) {
    params.bgColor = contrastColor(getRGBFromColorName(params.textColor));
  } else if (!params.bgColor && !params.textColor) {
    params.bgColor = `var(--bs-gray-dark)`;
    params.textColor = "white";
  }

  if (!endtime) {
    endtime = 0;
    params.completeText = "No endtime parameter provided in the URL.";
    console.error("No endtime parameter provided in the URL.");
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
  const elements = {
    body: document.getElementsByTagName("body")[0],
    completeContainer: document.getElementById("complete-container"),
    completeText: document.getElementById("complete-text"),
    description: document.getElementById("page-description"),
    descriptionContainer: document.getElementById("description-container"),
    endDate: document.getElementById("endtime-date"),
    endTZ: document.getElementById("endtime-timezone"),
    footer: document.getElementById("page-footer"),
    footerContainer: document.getElementsByTagName("footer")[0],
    headerIcons: [...document.getElementsByClassName("header-icon")],
    image: document.getElementById("image"),
    main: document.getElementsByTagName("main")[0],
    title: document.getElementById("page-title"),
  };

  elements.endDate.textContent = formattedDate;
  elements.endTZ.textContent = `${userTimeZone} time`;

  if (params.title) {
    elements.title.textContent = params.title;
  } else {
    elements.style.display = "none";
  }

  if (params.description) {
    elements.description.textContent = params.description;
  } else {
    elements.descriptionContainer.style.display = "none";
  }

  if (params.footer) {
    elements.footer.textContent = params.footer;
  } else {
    elements.footerContainer.style.display = "none";
  }

  elements.body.style.backgroundColor = params.bgColor;
  elements.body.style.color = params.textColor;
  elements.headerIcons.forEach((icon) => {
    icon.style.fill = params.textColor;
  });

  if (params.image) {
    elements.image.setAttribute("src", `./emojis/${params.image}.svg`);
    elements.image.setAttribute("alt", params.image);
  }

  if (Date.now() > endDate.getTime()) {
    elements.footerContainer.style.display = "none";
    elements.main.style.display = "none";
    elements.descriptionContainer.style.display = "none";
    elements.completeText.textContent = params.completeText;
  } else {
    elements.completeContainer.style.display = "none";
    initializeClock(endDate);
  }
});
