import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import PasswordInput from "../components/ui/PasswordInput.jsx";
import { Tabs } from "../components/ui/Tabs.jsx";
import { api } from "../lib/api.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js"; // <-- hook de autenticação

// Schemas
const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha.")
});

const signupSchema = z
  .object({
    firstName: z.string().min(1, "Informe o nome."),
    lastName: z.string().min(1, "Informe o sobrenome."),
    email: z.string().email("E-mail inválido."),
    password: z.string().min(8, "Mínimo de 8 caracteres."), // bate com o backend
    confirm: z.string().min(1, "Confirme a senha.")
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem."
  });

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth(); // <-- pega a função login do hook
  const [tab, setTab] = useState("login");
  const [toast, setToast] = useState(null);

  // LOGIN
  const {
    register: rLogin,
    handleSubmit: hLogin,
    formState: { errors: eLogin, isSubmitting: loadingLogin }
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onLogin = async (data) => {
    setToast(null);
    try {
      const user = await api.login(data);
      login(user); // <-- salva no estado + localStorage
      setToast({ type: "ok", msg: `Bem-vindo(a), ${user.firstName}!` });
      setTimeout(() => navigate("/home"), 800);
    } catch (err) {
      setToast({ type: "err", msg: err.message || "Erro ao entrar." });
    }
  };

  // SIGNUP
  const {
    register: rSign,
    handleSubmit: hSign,
    formState: { errors: eSign, isSubmitting: loadingSign }
  } = useForm({ resolver: zodResolver(signupSchema) });

  const onSignup = async (data) => {
    setToast(null);
    try {
      const { firstName, lastName, email, password } = data;
      const user = await api.signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password
      });
      login(user); // <-- salva no estado + localStorage
      setToast({ type: "ok", msg: "Conta criada!" });
      setTimeout(() => navigate("/home"), 800);
    } catch (err) {
      setToast({ type: "err", msg: err.message || "Erro ao cadastrar." });
    }
  };

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "login", label: "Entrar" },
          { value: "signup", label: "Criar conta" }
        ]}
      />

      {tab === "login" ? (
        <section>
          <h3 style={{ fontSize: "1.6rem", margin: "10px 0" }}>Entrar</h3>
          <div className="panel">
            <form onSubmit={hLogin(onLogin)} className="form-grid">
              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                error={eLogin.email?.message}
                {...rLogin("email")}
              />
              <PasswordInput
                label="Senha"
                placeholder="••••••••"
                error={eLogin.password?.message}
                {...rLogin("password")}
              />
              <Button className="full btn-login" type="submit" disabled={loadingLogin}>
                {loadingLogin ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </div>
        </section>
      ) : (
        <section>
          <h3 style={{ fontSize: "1.6rem", margin: "10px 0" }}>Criar conta</h3>
          <div className="panel">
            <form onSubmit={hSign(onSignup)} className="form-grid">
              <div className="form-2col">
                <Input
                  label="Nome"
                  error={eSign.firstName?.message}
                  {...rSign("firstName")}
                />
                <Input
                  label="Sobrenome"
                  error={eSign.lastName?.message}
                  {...rSign("lastName")}
                />
              </div>
              <Input
                label="E-mail"
                type="email"
                error={eSign.email?.message}
                {...rSign("email")}
              />
              <PasswordInput
                label="Senha"
                error={eSign.password?.message}
                {...rSign("password")}
              />
              <PasswordInput
                label="Confirme a senha"
                error={eSign.confirm?.message}
                {...rSign("confirm")}
              />
              <Button
                className="full btn-login"
                type="submit"
                variant="outline"
                disabled={loadingSign}
              >
                {loadingSign ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </form>
          </div>
        </section>
      )}

      {toast && (
        <div
          className={`toast ${toast.type === "err" ? "toast-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
