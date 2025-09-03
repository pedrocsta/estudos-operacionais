import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());

const pubUser = ({ passwordHash, ...u }) => u;

/* ----------------- auth ----------------- */
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "Preencha todos os campos." });
    if (password.length < 8)
      return res.status(400).json({ message: "A senha deve ter pelo menos 8 caracteres." });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: "E-mail já cadastrado." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { firstName, lastName, email: email.toLowerCase(), passwordHash }
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
    const user = await prisma.user.findUnique({ where: { email: (email || "").toLowerCase() } });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

    const ok = await bcrypt.compare(password || "", user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Senha inválida." });

    res.json(pubUser(user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao entrar." });
  }
});

/* ----------------- subjects ----------------- */
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
    if (e && e.code === "P2002") return res.status(409).json({ error: "Já existe uma disciplina com esse nome" });
    if (e && e.code === "P2003") return res.status(400).json({ error: "Usuário inválido" });
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

    const updated = await prisma.subject.update({ where: { id }, data: { name, color } });
    res.json(updated);
  } catch (e) {
    if (e && e.code === "P2025") return res.status(404).json({ error: "Disciplina não encontrada" });
    if (e && e.code === "P2002") return res.status(409).json({ error: "Já existe uma disciplina com esse nome" });
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
    if (e && e.code === "P2025") return res.status(404).json({ error: "Disciplina não encontrada" });
    if (e && e.code === "P2003") return res.status(409).json({ error: "Não é possível excluir: há estudos vinculados a esta disciplina." });
    console.error("DELETE /api/subjects/:id failed:", e);
    res.status(500).json({ error: "Erro ao excluir disciplina" });
  }
});

/* ----------------- studies (StudyDetail) ----------------- */

/** Converte "HH:MM:SS" para minutos inteiros */
function hmsToMinutes(hms) {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(String(hms || ""));
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]), s = Number(m[3]);
  return Math.floor(h * 60 + mm + s / 60);
}

/* ADIÇÃO: parser flexível e suporte a durationMin */
/** Aceita "HH:MM:SS" ou "HH:MM" (retorna minutos ou null) */
function parseFlexibleHmsToMinutes(hms) {
  if (hms == null) return null;
  const str = String(hms);
  let m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(str);
  if (m) {
    const h = Number(m[1]), mm = Number(m[2]), s = Number(m[3]);
    if ([h, mm, s].some((x) => Number.isNaN(x))) return null;
    return Math.floor(h * 60 + mm + s / 60);
  }
  m = /^(\d{1,2}):(\d{2})$/.exec(str);
  if (m) {
    const h = Number(m[1]), mm = Number(m[2]);
    if ([h, mm].some((x) => Number.isNaN(x))) return null;
    return h * 60 + mm;
  }
  return null;
}

/** POST /api/studies  -> cria um StudyDetail */
app.post("/api/studies", async (req, res) => {
  try {
    const {
      userId,
      subjectId,
      category,
      duration,       // "HH:MM:SS" (opcional se enviar durationMin)
      durationMin: durationMinFromBody, // aceitar minutos direto
      content,
      questionsRight,
      questionsWrong,
      pageStart,
      pageEnd,
      comment,
      studyDate,      // "YYYY-MM-DD"
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
      return res.status(400).json({ error: "Tempo inválido. Use HH:MM:SS ou envie durationMin em minutos." });
    }

    const [user, subject] = await Promise.all([
      prisma.user.findUnique({ where: { id: String(userId) } }),
      prisma.subject.findUnique({ where: { id: String(subjectId) } }),
    ]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!subject || subject.userId !== userId) return res.status(404).json({ error: "Disciplina inválida" });

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
      return res.status(400).json({ error: "Relação inválida: verifique usuário e disciplina." });
    }
    console.error("POST /api/studies failed:", e);
    res.status(500).json({ error: "Erro ao salvar estudo" });
  }
});

/* ----------------- util: dias estudados ----------------- */
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
        select: { studyDate: true }
      }),
      prisma.studyDetail.findMany({
        where: { userId, studyDate: { gte: start, lt: tomorrowStart } },
        select: { studyDate: true }
      })
    ]);

    const studiedSet = new Set([
      ...records.map((r) => ymdLocal(toLocalDateOnly(new Date(r.studyDate)))),
      ...details.map((d) => ymdLocal(toLocalDateOnly(new Date(d.studyDate))))
    ]);

    const estudos = [];
    for (let d = new Date(todayStart); d >= start; d.setDate(d.getDate() - 1)) {
      const key = ymdLocal(d);
      estudos.push({
        data: d.toLocaleDateString("pt-BR"),
        estudou: studiedSet.has(key)
      });
    }

    res.json({ estudos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao calcular estudos por dia" });
  }
});

// LISTAR STUDIES (StudyDetail)
app.get("/api/studies", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });

    const fromStr = req.query.from; // "YYYY-MM-DD"
    const toStr = req.query.to;     // "YYYY-MM-DD" (inclusive)
    const order = (req.query.order || "desc").toString().toLowerCase() === "asc" ? "asc" : "desc";
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

    res.json({
      total,
      limit,
      offset,
      order,
      items,
    });
  } catch (e) {
    console.error("GET /api/studies failed:", e);
    res.status(500).json({ error: "Erro ao listar estudos" });
  }
});

/* DELETE /api/studies/:id */
app.delete("/api/studies/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.studyDetail.delete({ where: { id } });
    res.json({ ok: true, deletedId: id });
  } catch (e) {
    if (e && e.code === "P2025") {
      return res.status(404).json({ error: "Estudo não encontrado" });
    }
    console.error("DELETE /api/studies/:id failed:", e);
    res.status(500).json({ error: "Erro ao excluir estudo" });
  }
});

/* ============ ADIÇÃO: metas semanais (fixas) por usuário ============ */

// GET /api/goals/weekly-setting?userId=...
app.get("/api/goals/weekly-setting", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });
    const setting = await prisma.weeklyGoalSetting.findUnique({ where: { userId } });
    res.json({
      userId,
      hoursTargetMin: setting?.hoursTargetMin ?? 0,
      questionsTarget: setting?.questionsTarget ?? 0,
    });
  } catch (e) {
    console.error("GET /api/goals/weekly-setting failed:", e);
    res.status(500).json({ error: "Erro ao carregar metas" });
  }
});

// PUT /api/goals/weekly-setting  { userId, hoursTargetMin, questionsTarget }
app.put("/api/goals/weekly-setting", async (req, res) => {
  try {
    const { userId, hoursTargetMin, questionsTarget } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId é obrigatório" });
    const h = Math.max(0, Math.floor(Number(hoursTargetMin) || 0));
    const q = Math.max(0, Math.floor(Number(questionsTarget) || 0));

    const up = await prisma.weeklyGoalSetting.upsert({
      where: { userId: String(userId) },
      create: { userId: String(userId), hoursTargetMin: h, questionsTarget: q },
      update: { hoursTargetMin: h, questionsTarget: q },
    });

    res.json(up);
  } catch (e) {
    console.error("PUT /api/goals/weekly-setting failed:", e);
    res.status(500).json({ error: "Erro ao salvar metas" });
  }
});
/* ========================== FIM ADIÇÃO ========================== */

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
