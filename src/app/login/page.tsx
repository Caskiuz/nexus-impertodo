import Link from 'next/link';
import { loginAction } from '@/app/actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <div className="login-wrap">
      <div className="login-scene" aria-hidden="true">
        <div className="scene-glow" />
        <div className="scene-grid" />
        <div className="wave w1" />
        <div className="wave w2" />
        <div className="wave w3" />
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        <div className="orb o4" />
        <div className="orb o5" />
        <div className="orb o6" />
        <div className="scene-sheen" />
      </div>
      <div className="login-card">
        <div className="mark">I</div>
        <h1>IMPERTODO AI OS</h1>
        <div className="sub">Sistema operativo de impermeabilización · by Nexus</div>
        {params.error && <div className="alert r">Correo o contraseña incorrectos. Intenta de nuevo.</div>}
        <form action={loginAction}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" name="email" type="email" required placeholder="gerencia@impertodo.mx" defaultValue="gerencia@impertodo.mx" />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required placeholder="••••••••" defaultValue="impertodo2026" />
          </div>
          <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
            Entrar al sistema →
          </button>
        </form>
        <div className="demo-users">
          <b>Usuarios demo</b> (contraseña <code>impertodo2026</code>, dev: <code>nexus2026</code>)
          <br />
          <code>gerencia@impertodo.mx</code> · <code>admin@impertodo.mx</code> · <code>supervisor@impertodo.mx</code>
          <br />
          <code>contador@impertodo.mx</code> · <code>central@impertodo.mx</code> · <code>dev@nexus.mx</code>
          <br />
          <Link href="/p/2026-042" style={{ fontWeight: 700 }}>Ver propuesta viva pública (demo)</Link>
        </div>
      </div>
    </div>
  );
}
