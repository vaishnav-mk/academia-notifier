import { Hono } from "hono";

const app = new Hono();

const fetchScraper = (url: string, csrfToken: string) => {
  return fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
  });
};

const login = async (account: string, password: string, SCRAPE_URL: string) => {
  const loginRes = await fetch(`https://${SCRAPE_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ account, password }),
  });
  const loginData = await loginRes.json();
  return loginData.cookies;
};

const fetchInfo = async (csrfToken: string, SCRAPE_URL: string) => {
  const [marksRes, attendanceRes] = await Promise.all([
    fetchScraper(`https://${SCRAPE_URL}/api/marks`, csrfToken),
    fetchScraper(`https://${SCRAPE_URL}/api/attendance`, csrfToken),
  ]);

  return Promise.all([marksRes.json(), attendanceRes.json()]);
};

app.get("/ping", (c) => {
  return c.json({ message: "pong" });
});

app.get("/reset", async (c) => {
  const { notifier } = c.env;
  await notifier.put("marks", "[]");
  await notifier.put("attendance", "[]");
  await notifier.put("lastUpdated", new Date().toISOString());
  return c.json({ message: "Data reset" });
});

app.get("/", async (c) => {
  const { notifier, ACCOUNT, PASSWORD, BOT_TOKEN, CHANNEL_ID, SCRAPE_URL } =
    c.env;

  const { force } =
    c.req.query().force === "true"
      ? { force: true }
      : ({ force: false } as { force: boolean });

  const csrfToken =
    (await notifier.get("csrfToken")) ||
    (await login(ACCOUNT, PASSWORD, SCRAPE_URL));
  await notifier.put("csrfToken", csrfToken);

  let [marks, attendance] = await fetchInfo(csrfToken, SCRAPE_URL);

  if (attendance.logout || marks.logout) {
    const newCsrfToken = await login(ACCOUNT, PASSWORD, SCRAPE_URL);
    await notifier.put("csrfToken", newCsrfToken);
    [marks, attendance] = await fetchInfo(newCsrfToken, SCRAPE_URL);
  }

  const currentMarks = marks.marks.map(({ courseCode, overall }) => ({
    courseCode,
    overall: overall.total,
  }));
  const currentAttendance = attendance.attendance.map(
    ({ courseCode, attendancePercentage }) => ({
      courseCode,
      attendancePercentage,
    })
  );

  const prevMarks = force
    ? []
    : JSON.parse((await notifier.get("marks")) || "[]");
  const prevAttendance = force
    ? []
    : JSON.parse((await notifier.get("attendance")) || "[]");

  const marksDiff = currentMarks.filter(
    (mark) =>
      !prevMarks.some(
        (prev) =>
          prev.courseCode === mark.courseCode && prev.overall === mark.overall
      )
  );

  const attendanceDiff = currentAttendance.filter(
    (att) =>
      !prevAttendance.some(
        (prev) =>
          prev.courseCode === att.courseCode &&
          prev.attendancePercentage === att.attendancePercentage
      )
  );

  if (marksDiff.length || attendanceDiff.length) {
    await notifier.put("marks", JSON.stringify(currentMarks));
    await notifier.put("attendance", JSON.stringify(currentAttendance));
    await notifier.put("lastUpdated", new Date().toISOString());

    const embeds = [
      {
        title: "Marks",
        description: "Current Marks",
        fields: marks.marks.map((mark) => ({
          name: mark.courseName,
          value: mark.courseType,
          inline: true,
        })),
        timestamp: new Date().toISOString(),
        color: 16711680,
      },
      {
        title: "Attendance",
        description: "Current Attendance",
        fields: attendance.attendance.map((att) => ({
          name: att.courseTitle,
          value: att.attendancePercentage,
          inline: true,
        })),
        timestamp: new Date().toISOString(),
        color: 16711680,
      },
    ];

    const sendDiscordMessage = await fetch(
      `https://discord.com/api/v9/channels/${CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${BOT_TOKEN}`,
        },
        body: JSON.stringify({ content: "@everyone", embeds }),
      }
    );

    const res = await sendDiscordMessage.json();
    return c.json({ res });
  } else {
    return c.json({ message: "No new updates found" });
  }
});

export default app;
