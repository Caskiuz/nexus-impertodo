import Link from 'next/link';
import { allPhotos, photoUrl, UNSPLASH_HOME } from '@/lib/photos';

export const metadata = { title: 'Créditos de fotografías · IMPERTODO' };

export default function CreditosPage() {
  const photos = allPhotos();

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 18px 60px' }}>
      <div className="head">
        <div>
          <div className="eyebrow">Licencias y atribuciones</div>
          <h1>Créditos de fotografías</h1>
          <div className="sub">
            Las fotos del catálogo provienen de Unsplash y se muestran desde su CDN (hotlink), conforme a las guías de la
            API de Unsplash. Licencia:{' '}
            <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
              Unsplash License
            </a>
            .
          </div>
        </div>
        <div className="actions">
          <Link className="btn" href="/hoy">
            Volver a la app
          </Link>
        </div>
      </div>

      <div className="card tbl">
        <table>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Uso</th>
              <th>Fotógrafo</th>
              <th>Enlace</th>
            </tr>
          </thead>
          <tbody>
            {photos.map(({ kind, slug, photo }) => (
              <tr key={kind + slug}>
                <td>
                  <img
                    className="img-thumb"
                    src={photoUrl(photo, 240)}
                    alt={`${kind} ${slug}`}
                    loading="lazy"
                  />
                </td>
                <td>
                  <b>{kind}</b>
                  <div className="mini">{slug}</div>
                </td>
                <td>{photo.photographer}</td>
                <td>
                  <a href={photo.page} target="_blank" rel="noreferrer">
                    Ver en Unsplash
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mini" style={{ marginTop: 12 }}>
        Fotos servidas por{' '}
        <a href={UNSPLASH_HOME} target="_blank" rel="noreferrer">
          Unsplash
        </a>
        . Cada uso disparó el evento de descarga correspondiente en la API.
      </div>
    </div>
  );
}
