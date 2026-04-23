import React from "react";
import bg from "../assets/login-bg.png";

export default function LoginPage({
  email,
  password,
  setEmail,
  setPassword,
  onLogin,
  loading,
}) {
  return (
    <div style={styles.container}>
      
      {/* 배경 */}
      <div style={styles.bg} />

      {/* 로그인 카드 */}
      <div style={styles.card}>
        
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>
          Sign in to continue to <span style={{color:"#3b82f6"}}>DURAE</span>
        </p>

        <div style={styles.divider} />

        {/* 이메일 */}
        <div style={styles.inputWrap}>
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* 비밀번호 */}
        <div style={styles.inputWrap}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* 옵션 */}
        <div style={styles.options}>
          <label>
            <input type="checkbox" /> Remember me
          </label>
          <span style={styles.forgot}>Forgot password?</span>
        </div>

        {/* 버튼 */}
        <button onClick={onLogin} style={styles.button}>
          {loading ? "Authenticating..." : "Sign In →"}
        </button>

        <p style={styles.secure}>🔒 Secure & Protected</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "relative",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "'Pretendard', sans-serif",
  },

  bg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundImage: `url(${bg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  },

  card: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",

    width: 420,
    padding: 40,
    borderRadius: 20,

    background: "rgba(15,23,42,0.6)",
    backdropFilter: "blur(16px)",

    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",

    color: "#fff",
    textAlign: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },

  divider: {
    width: 40,
    height: 2,
    background: "#3b82f6",
    margin: "12px auto 24px",
  },

  inputWrap: {
    marginBottom: 14,
  },

  input: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    outline: "none",
  },

  options: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    marginBottom: 20,
    color: "#94a3b8",
  },

  forgot: {
    color: "#3b82f6",
    cursor: "pointer",
  },

  button: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #3b82f6, #2563eb)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  secure: {
    marginTop: 20,
    fontSize: 12,
    color: "#94a3b8",
  },
};