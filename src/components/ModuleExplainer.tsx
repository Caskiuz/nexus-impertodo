export default function ModuleExplainer({
  title = '¿Qué es esto y cómo me sirve? (30 segundos de lectura)',
  points
}: {
  title?: string;
  points: string[];
}) {
  return (
    <details className="card panel" style={{ marginBottom: 15 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--azul-700)' }}>💡 {title}</summary>
      <div style={{ marginTop: 10 }}>
        {points.map((p, i) => (
          <div className="rule" key={i}>
            <span className={`ic ${i === points.length - 1 ? 'info' : 'ok'}`}>{i === points.length - 1 ? 'i' : '✓'}</span>
            <div>{p}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
