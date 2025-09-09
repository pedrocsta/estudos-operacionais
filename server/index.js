import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

// ===== Acesso ao SQLite (questoes.db) =====
import { getQuestionsDb } from "./sqlite.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 4000;

// Suporta múltiplas origens separadas por vírgula (ex.: "http://localhost:5173,https://xxx.pages.dev")
const ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CORS com lista de origens permitidas
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // permite health checks e calls internas
      if (ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "x-admin-email"], // garante o header customizado
  })
);

app.use(express.json());

// --- util ---
const pubUser = ({ passwordHash, ...u }) => u;

/* ================== HEALTH ================== */
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

/* ================== AUTH ================== */
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "Preencha todos os campos." });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "A senha deve ter pelo menos 8 caracteres." });

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) return res.status(409).json({ message: "E-mail já cadastrado." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { firstName, lastName, email: email.toLowerCase(), passwordHash },
    });

    res.status(201).json(pubUser(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao cadastrar." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({
      where: { email: (email || "").toLowerCase() },
    });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

    const ok = await bcrypt.compare(password || "", user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Senha inválida." });

    res.json(pubUser(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao entrar." });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.studyDetail.deleteMany({ where: { userId: id } });
      await tx.studyRecord.deleteMany({ where: { userId: id } });
      await tx.weeklyGoalSetting.deleteMany({ where: { userId: id } });
      await tx.subject.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    if (e?.code === "P2003") {
      return res
        .status(409)
        .json({ error: "Não foi possível excluir: existem dados vinculados ao usuário." });
    }
    console.error("DELETE /api/users/:id failed:", e);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

app.get("/api/stats/overview", async (req, res) => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
    const requester = String(req.header("x-admin-email") || "").toLowerCase();
    if (!adminEmail || requester !== adminEmail) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [usersCount, agg] = await Promise.all([
      prisma.user.count(),
      prisma.studyDetail.aggregate({ _sum: { durationMin: true } }),
    ]);

    res.json({ usersCount, totalMinutes: agg?._sum?.durationMin || 0 });
  } catch (e) {
    console.error("GET /api/stats/overview failed:", e);
    res.status(500).json({ error: "Erro ao carregar estatísticas" });
  }
});

/* ================== SUBJECTS ================== */
app.get("/api/subjects", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });

    const subjects = await prisma.subject.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    res.json(subjects);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar disciplinas" });
  }
});

app.post("/api/subjects", async (req, res) => {
  try {
    const { userId, name, color } = req.body || {};
    if (!userId || !String(userId).trim())
      return res.status(400).json({ error: "userId é obrigatório" });

    const trimmedName = String(name || "").trim();
    if (!trimmedName) return res.status(400).json({ error: "Informe um nome" });

    const colorStr = String(color || "").trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(colorStr))
      return res.status(400).json({ error: "Cor inválida. Use #RRGGBB." });

    const user = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (!user) return res.status(400).json({ error: "Usuário inválido" });

    const created = await prisma.subject.create({
      data: { userId: String(userId), name: trimmedName, color: colorStr },
    });

    res.status(201).json(created);
  } catch (e) {
    if (e && e.code === "P2002")
      return res.status(409).json({ error: "Já existe uma disciplina com esse nome" });
    if (e && e.code === "P2003")
      return res.status(400).json({ error: "Usuário inválido" });
    console.error("POST /api/subjects failed:", e);
    res.status(500).json({ error: "Erro ao criar disciplina" });
  }
});

app.put("/api/subjects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const name = String(req.body?.name || "").trim();
    const color = String(req.body?.color || "").trim();

    if (!name) return res.status(400).json({ error: "Informe um nome" });
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return res.status(400).json({ error: "Cor inválida. Use #RRGGBB." });

    const updated = await prisma.subject.update({
      where: { id },
      data: { name, color },
    });
    res.json(updated);
  } catch (e) {
    if (e && e.code === "P2025")
      return res.status(404).json({ error: "Disciplina não encontrada" });
    if (e && e.code === "P2002")
      return res.status(409).json({ error: "Já existe uma disciplina com esse nome" });
    console.error("PUT /api/subjects/:id failed:", e);
    res.status(500).json({ error: "Erro ao atualizar disciplina" });
  }
});

app.delete("/api/subjects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.subject.delete({ where: { id } });
    res.status(200).json({ ok: true });
  } catch (e) {
    if (e && e.code === "P2025")
      return res.status(404).json({ error: "Disciplina não encontrada" });
    if (e && e.code === "P2003")
      return res
        .status(409)
        .json({ error: "Não é possível excluir: há estudos vinculados a esta disciplina." });
    console.error("DELETE /api/subjects/:id failed:", e);
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

/* ================== STUDIES (StudyDetail) ================== */
function hmsToMinutes(hms) {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(hms || ""));
  if (!m) return null;
  const h = Number(m[1]),
    mm = Number(m[2]),
    s = Number(m[3]);
  return Math.floor(h * 60 + mm + s / 60);
}
function parseFlexibleHmsToMinutes(hms) {
  if (hms == null) return null;
  const str = String(hms);
  let m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(str);
  if (m) {
    const h = Number(m[1]),
      mm = Number(m[2]),
      s = Number(m[3]);
    if ([h, mm, s].some((x) => Number.isNaN(x))) return null;
    return Math.floor(h * 60 + mm + s / 60);
  }
  m = /^(\d{1,2}):(\d{2})$/.exec(str);
  if (m) {
    const h = Number(m[1]),
      mm = Number(m[2]);
    if ([h, mm].some((x) => Number.isNaN(x))) return null;
    return h * 60 + mm;
  }
  return null;
}

app.post("/api/studies", async (req, res) => {
  try {
    const {
      userId,
      subjectId,
      category,
      duration,
      durationMin: durationMinFromBody,
      content,
      questionsRight,
      questionsWrong,
      pageStart,
      pageEnd,
      comment,
      studyDate,
    } = req.body || {};

    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });
    if (!subjectId) return res.status(400).json({ error: "subjectId é obrigatório" });
    if (!category) return res.status(400).json({ error: "Categoria é obrigatória" });

    let durationMin = null;
    const dm = Number(durationMinFromBody);
    if (Number.isFinite(dm) && dm >= 0) {
      durationMin = Math.floor(dm);
    } else {
      durationMin = parseFlexibleHmsToMinutes(duration);
      if (durationMin == null) durationMin = hmsToMinutes(duration);
    }
    if (durationMin == null) {
      return res
        .status(400)
        .json({ error: "Tempo inválido. Use HH:MM:SS ou envie durationMin em minutos." });
    }

    const [user, subject] = await Promise.all([
      prisma.user.findUnique({ where: { id: String(userId) } }),
      prisma.subject.findUnique({ where: { id: String(subjectId) } }),
    ]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!subject || subject.userId !== userId)
      return res.status(404).json({ error: "Disciplina inválida" });

    let studyDateObj = new Date();
    if (studyDate && /^\d{4}-\d{2}-\d{2}$/.test(studyDate)) {
      const [y, m, d] = studyDate.split("-").map(Number);
      studyDateObj = new Date(y, m - 1, d);
    }

    const created = await prisma.studyDetail.create({
      data: {
        userId: String(userId),
        subjectId: String(subjectId),
        category: String(category),
        color: subject.color,
        studyDate: studyDateObj,
        durationMin,
        content: String(content || ""),
        questionsRight: Number(questionsRight) || 0,
        questionsWrong: Number(questionsWrong) || 0,
        pageStart: pageStart == null || pageStart === "" ? null : Number(pageStart),
        pageEnd: pageEnd == null || pageEnd === "" ? null : Number(pageEnd),
        comment: comment == null || comment === "" ? null : String(comment),
      },
    });

    res.status(201).json(created);
  } catch (e) {
    if (e && e.code === "P2003") {
      return res
        .status(400)
        .json({ error: "Relação inválida: verifique usuário e disciplina." });
    }
    console.error("POST /api/studies failed:", e);
    res.status(500).json({ error: "Erro ao salvar estudo" });
  }
});

app.get("/api/studies/days", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId obrigatório" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    const toLocalDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const ymdLocal = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStart = toLocalDateOnly(new Date());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    let start = toLocalDateOnly(new Date(user.createdAt));
    if (start > todayStart) start = todayStart;

    const [records, details] = await Promise.all([
      prisma.studyRecord.findMany({
        where: { userId, studyDate: { gte: start, lt: tomorrowStart } },
        select: { studyDate: true },
      }),
      prisma.studyDetail.findMany({
        where: { userId, studyDate: { gte: start, lt: tomorrowStart } },
        select: { studyDate: true },
      }),
    ]);

    const studiedSet = new Set([
      ...records.map((r) => ymdLocal(toLocalDateOnly(new Date(r.studyDate)))),
      ...details.map((d) => ymdLocal(toLocalDateOnly(new Date(d.studyDate)))),
    ]);

    const estudos = [];
    for (let d = new Date(todayStart); d >= start; d.setDate(d.getDate() - 1)) {
      const key = ymdLocal(d);
      estudos.push({
        data: d.toLocaleDateString("pt-BR"),
        estudou: studiedSet.has(key),
      });
    }

    res.json({ estudos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao calcular estudos por dia" });
  }
});

app.get("/api/studies", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });

    const fromStr = req.query.from; // "YYYY-MM-DD"
    const toStr = req.query.to; // "YYYY-MM-DD" (inclusive)
    const order =
      (req.query.order || "desc").toString().toLowerCase() === "asc" ? "asc" : "desc";
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const where = { userId };
    if (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr)) {
      const [y, m, d] = fromStr.split("-").map(Number);
      where.studyDate = { ...(where.studyDate || {}), gte: new Date(y, m - 1, d) };
    }
    if (toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      const [y, m, d] = toStr.split("-").map(Number);
      const toPlus1 = new Date(y, m - 1, d);
      toPlus1.setDate(toPlus1.getDate() + 1);
      where.studyDate = { ...(where.studyDate || {}), lt: toPlus1 };
    }

    const [items, total] = await Promise.all([
      prisma.studyDetail.findMany({
        where,
        orderBy: { studyDate: order },
        skip: offset,
        take: limit,
        include: {
          subject: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.studyDetail.count({ where }),
    ]);

    res.json({ total, limit, offset, order, items });
  } catch (e) {
    console.error("GET /api/studies failed:", e);
    res.status(500).json({ error: "Erro ao listar estudos" });
  }
});

/* ================== QUESTIONS (SQLite: questoes.db) ================== */

// Mapper (inclui subtopico_caminho diretamente da tabela question)
function mapQuestionRow(row) {
  let alternatives = [];
  try { alternatives = JSON.parse(row.alternatives || "[]"); } catch {}
  return {
    id: row.id,
    year: row.year,
    board: row.board_name || null,
    subject: row.subject_name || null,
    topic: row.topic_name || null,
    subtopico_caminho: row.subtopico_caminho || null, // ← vem de q.subtopico_caminho
    level: row.level_name || null,
    alternativesCount: row.alternatives_count,
    correctLetter: row.correct_letter,
    statement: row.statement,
    supportText: row.support_text,
    commentText: row.comment_text,
    commentHtml: row.comment_html,
    alternatives,
  };
}

// GET /api/questions?search=&subject=&board=&year=&topic=&level=&page=1&pageSize=20
app.get("/api/questions", (req, res) => {
  try {
    const db = getQuestionsDb();

    const {
      search = "",
      subject = "",
      board = "",
      topic = "",
      level = "",
      year = "",
      page = "1",
      pageSize = "20",
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);

    const where = [];
    const params = {};

    if (search) {
      where.push("(q.statement LIKE @search OR q.support_text LIKE @search)");
      params.search = `%${search}%`;
    }
    if (subject) {
      where.push("s.name = @subject");
      params.subject = String(subject);
    }
    if (board) {
      where.push("b.name = @board");
      params.board = String(board);
    }
    if (topic) {
      // filtra pelo nome do tópico (rótulo curto salvo na tabela topic)
      where.push("t.name = @topic");
      params.topic = String(topic);
    }
    if (level) {
      where.push("l.name = @level");
      params.level = String(level);
    }
    if (year) {
      where.push("q.year = @year");
      params.year = Number(year);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const baseSelect = `
      FROM question q
      LEFT JOIN board   b ON b.id = q.board_id
      LEFT JOIN subject s ON s.id = q.subject_id
      LEFT JOIN topic   t ON t.id = q.topic_id
      LEFT JOIN level   l ON l.id = q.level_id
      ${whereSql}
    `;

    const totalRow = db.prepare(`SELECT COUNT(*) as total ${baseSelect}`).get(params);
    const total = totalRow?.total ?? 0;

    const items = db
      .prepare(
        `
      SELECT
        q.id, q.year, q.alternatives_count, q.correct_letter,
        q.statement, q.support_text, q.comment_text, q.comment_html, q.alternatives,
        q.subtopico_caminho AS subtopico_caminho,        -- << direto da question
        b.name AS board_name,
        s.name AS subject_name,
        t.name AS topic_name,
        l.name AS level_name
      ${baseSelect}
      ORDER BY q.year DESC, q.id ASC
      LIMIT @limit OFFSET @offset
    `
      )
      .all({ ...params, limit: ps, offset: (p - 1) * ps });

    res.json({
      total,
      page: p,
      pageSize: ps,
      items: items.map(mapQuestionRow),
    });
  } catch (e) {
    console.error("GET /api/questions failed:", e);
    // Em dev, retorne detalhe do erro para facilitar debug
    if (process.env.NODE_ENV === "development") {
      return res.status(500).json({ error: "Erro ao listar questões", detail: String(e?.message || e) });
    }
    res.status(500).json({ error: "Erro ao listar questões" });
  }
});

// Metadados para filtros (boards, subjects, topics, levels, years)
app.get("/api/questions/meta", (req, res) => {
  try {
    const db = getQuestionsDb();
    const pick = (sql) => db.prepare(sql).all().map((r) => r.name ?? r.year);
    res.json({
      boards:   pick("SELECT name FROM board ORDER BY name"),
      subjects: pick("SELECT name FROM subject ORDER BY name"),
      topics:   pick("SELECT name FROM topic ORDER BY name"),  // rótulo curto
      levels:   pick("SELECT name FROM level ORDER BY name"),
      years:    db.prepare("SELECT DISTINCT year FROM question WHERE year IS NOT NULL ORDER BY year DESC").all().map((r) => r.year),
    });
  } catch (e) {
    console.error("GET /api/questions/meta failed:", e);
    res.status(500).json({ error: "Erro ao carregar metadados" });
  }
});

/* ================== START ================== */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server on http://0.0.0.0:${PORT}`);
});
