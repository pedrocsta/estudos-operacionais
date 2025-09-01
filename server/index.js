import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());

// Utils
const pubUser = ({ passwordHash, ...u }) => u;

// Rotas
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "Preencha todos os campos." });
    if (password.length < 6)
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });

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

app.get("/api/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get("/api/studies/presence", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId obrigatório" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    // normaliza datas (dia sem hora)
    const toYMD = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const start = toYMD(new Date(user.createdAt));
    const today = toYMD(new Date());

    // busca todos os dias com estudo entre start e hoje
    const studies = await prisma.studyRecord.findMany({
      where: {
        userId,
        studyDate: { gte: start, lte: today }
      },
      select: { studyDate: true }
    });

    const studiedSet = new Set(
      studies.map((s) => s.studyDate.toISOString().slice(0, 10))
    );

    // gera presença (um item por dia, do cadastro até hoje)
    const presence = [];
    for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      const ymd = d.toISOString().slice(0, 10);
      presence.push({ date: ymd, hasStudy: studiedSet.has(ymd) });
    }

    // streak atual (contando de hoje para trás)
    let streakDays = 0;
    for (let i = presence.length - 1; i >= 0; i--) {
      if (presence[i].hasStudy) streakDays++;
      else break;
    }

    res.json({ presence, streakDays, start: start.toISOString().slice(0,10) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao calcular presença" });
  }
});

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});