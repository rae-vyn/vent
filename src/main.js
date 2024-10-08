/* eslint-disable no-unused-vars */
/* eslint no-console: error */
import { invoke } from "@tauri-apps/api/core";
import { Chart } from "chart.js/auto";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { message, confirm, save } from "@tauri-apps/plugin-dialog";
import { createStore } from "@tauri-apps/plugin-store";
import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

import $ from "jquery";
import { DateTime } from "luxon";

let permissionGranted = await isPermissionGranted();
let store = await createStore("store.bin");

if (!permissionGranted) {
  const permission = await requestPermission();
  permissionGranted = permission === "granted";
}

const plugin = {
  id: "customCanvasBackgroundColor",
  beforeDraw: (chart, _, options) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = options.color || "#99ffff";
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

let chart = new Chart(document.getElementById("mood_chart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Mood Rating",
        data: [],
      },
    ],
  },
  options: {
    plugins: {
      customCanvasBackgroundColor: {
        color: "white",
      },
      title: {
        display: true,
        text: "Mood Rating Over Time",
      },
    },
    responsive: true,
  },
  plugins: [plugin],
});

await refreshChart();

async function refreshChart() {
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  const entries = await store.entries();
  if (entries.length == 0) {
    return;
  }
  const stripped_entries = entries.map((entry) => {
    return {
      date: entry[1].date,
      score: entry[1].scores.compound,
      pureTime: entry[1].pureTime,
    };
  });
  chart.data.datasets[0].data = stripped_entries
    .map((entry) => {
      return { pt: entry.pureTime, score: entry.score, date: entry.date };
    })
    .sort((l, r) => {
      if (l.pt < r.pt) {
        return -1;
      } else if (l.pt > r.pt) {
        return 1;
      } else {
        return 0;
      }
    });
  chart.data.labels = chart.data.datasets[0].data.map((entry) => entry.date);
  chart.data.datasets[0].data = chart.data.datasets[0].data.map(
    (entry) => entry.score
  );
  chart.update();
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function submit(data) {
  const now = DateTime.now();
  const id = getRandomInt(1000, 9999);
  const info = {
    text: data,
    date: now.toLocaleString(DateTime.DATETIME_SHORT),
    scores: await invoke("analyze", { input: data }),
    pureTime: now.toMillis(),
  };

  await store.set(id.toString(), info);

  store.save().then(async (_) => {
    await message(`You can check the ID of this note by hitting the button.`);
  });

  await refreshChart();
}

async function query(request) {
  let res = await store.get(request);
  if (res) {
    await message(res.text);
  } else {
    await message("Note not found.");
  }
}

async function list() {
  let result = "";
  let entries = await store.entries();
  for (let entry of entries) {
    let id = entry[0];
    let data = entry[1];
    let text = data.text.split(/\s+/).slice(0, 5).join(" ");
    result = result.concat("\n", `${id}: ${text}...`);
  }
  if (result.length != 0) await message(result);
  else await message("None found!");
}

async function clear() {
  let response = await confirm(
    "Are you sure you want to delete all of your notes? You can't get them back!"
  );
  if (response) {
    await store.clear();
  }
  await refreshChart();
}

async function store_as_csv() {
  let entries = await store.entries();
  let res = "";
  res += "id,text,date,score\n";
  entries.forEach((entry) => {
    res += `${entry[0]},"${entry[1].text}",${entry[1].date.split(",")[0]},${
      entry[1].scores.compound
    }\n`;
  });
  return res;
}

async function write_file() {
  const path = await save({
    filters: [{ name: "CSV files", extensions: ["csv"] }],
  });
  await writeTextFile(path, await store_as_csv());

  await message("Export complete!");
}

await refreshChart();

$(() => {
  $("#vent-form").on("submit", async (e) => {
    e.preventDefault();
    submit($("#vent-input").val());
    $("#vent-input").val("");
    await refreshChart();
  });
  $("#recover-form").on("submit", (e) => {
    e.preventDefault();
    query($("#recover-input").val());
  });
  $("#recover").on("click", (_) => {
    $("#recover-form").toggle();
  });

  $("#list").on("click", async (_) => {
    await list();
  });
  $(".chart").on("click", async (_) => {
    let entries = await store.entries();
    if ((await entries.length) == 0) {
      await message("You haven't written any notes yet!");
      return;
    }
    $("#mood_container").toggle();
    $("#main").toggle();
  });
  $("#export").on("click", async (_) => {
    await write_file();
  });
  $("#clear").on("click", async (_) => {
    await clear();
  });
});
