require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const logger = {
  info: (...args) => console.info("[sheet-api]", ...args),
  warn: (...args) => console.warn("[sheet-api][warn]", ...args),
  error: (...args) => console.error("[sheet-api][error]", ...args),
};

const PORT = process.env.PORT || 4000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Login_NhutPT";
const SERVICE_ACCOUNT_B64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;

if (!SHEET_ID) {
  logger.warn(
    "Missing GOOGLE_SHEET_ID. Set it in your environment before starting the API server."
  );
}

if (!SERVICE_ACCOUNT_B64) {
  logger.warn(
    "Missing GOOGLE_SERVICE_ACCOUNT_B64. Set it to the base64-encoded service account JSON."
  );
}

function decodeServiceAccount() {
  if (!SERVICE_ACCOUNT_B64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_B64");
  }
  const json = Buffer.from(SERVICE_ACCOUNT_B64, "base64").toString("utf8");
  return JSON.parse(json);
}

async function getSheetsClient() {
  const svc = decodeServiceAccount();
  const auth = new google.auth.JWT(
    svc.client_email,
    undefined,
    svc.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  await auth.authorize();
  return google.sheets({
    version: "v4",
    auth,
  });
}

function buildResponse(res, payload) {
  return res
    .status(200)
    .set("Content-Type", "application/json")
    .send(JSON.stringify(payload));
}

async function handleGetState(req, res) {
  logger.info("Incoming get-state request");
  if (!SHEET_ID) {
    return res.status(500).json({
      success: false,
      error: "Missing GOOGLE_SHEET_ID on server",
    });
  }
  try {
    const sheets = await getSheetsClient();
    const range = `${SHEET_NAME}!A2:E`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = response.data.values || [];
    const [firstRow] = rows;
    const imageRow = rows.length > 1 ? rows[1] : firstRow;
    const imageValue =
      imageRow && imageRow.length >= 3 ? imageRow[2] : firstRow?.[2];
    logger.info(
      `Fetched ${rows.length} rows from sheet ${SHEET_ID}/${SHEET_NAME}`
    );
    const data = {
      A2: firstRow?.[0] ?? "",
      B2: firstRow?.[1] ?? "",
      C2: normalizeImageValue(firstRow?.[2]),
      C3: normalizeImageValue(imageValue),
      imageUrl: normalizeImageValue(imageValue),
      D2: firstRow?.[3] ?? "",
      E2: firstRow?.[4] ?? "",
      logs: rows
        .map((row, index) => ({
          row: index + 2,
          text: typeof row[4] === "string" ? row[4] : String(row[4] ?? ""),
        }))
        .filter((entry) => entry.text && entry.text.trim() !== ""),
    };

    return buildResponse(res, { success: true, data });
  } catch (error) {
    logger.error("get-state error", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error when reading sheet",
    });
  }
}

function normalizeImageValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  const imageFormulaMatch = trimmed.match(/^=IMAGE\(\s*"([^"]+)"(?:,.*)?\)$/i);
  if (imageFormulaMatch) {
    return imageFormulaMatch[1];
  }
  return trimmed;
}

async function handleUpdateCell(req, res) {
  logger.info("Incoming update-cell request", {
    cell: req.body?.cell,
    valuePreview:
      typeof req.body?.value === "string"
        ? req.body.value.slice(0, 20)
        : req.body?.value,
  });
  if (!SHEET_ID) {
    return res.status(500).json({
      success: false,
      error: "Missing GOOGLE_SHEET_ID on server",
    });
  }

  const { cell, value } = req.body || {};
  if (typeof cell !== "string") {
    return res.status(400).json({
      success: false,
      error: "Missing cell field (e.g., 'A2')",
    });
  }

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!${cell}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[value ?? ""]],
      },
    });

    return buildResponse(res, { success: true });
  } catch (error) {
    logger.error("update-cell error", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error when updating sheet",
    });
  }
}

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/sheet", async (req, res) => {
    logger.info("Received /sheet request", { action: req.body?.action });
    const action = req.body?.action;
    if (action === "get-state") {
      await handleGetState(req, res);
      return;
    }
    if (action === "update-cell") {
      await handleUpdateCell(req, res);
      return;
    }
    return res.status(400).json({
      success: false,
      error: "Unknown action",
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    logger.info(`listening on port ${PORT}`);
  });
}

main().catch((error) => {
  logger.error("failed to start", error);
  process.exit(1);
});
