import { systemCredit, elementCredit } from '@/lib/images';
import { UNSPLASH_HOME } from '@/lib/photos';

export default function PhotoCredit({ kind, id }: { kind: 'system' | 'element'; id: string }) {
  const credit = kind === 'system' ? systemCredit(id) : elementCredit(id);
  if (!credit) return null;
  return (
    <div className="photo-credit">
      Foto:{' '}
      <a href={credit.page} target="_blank" rel="noreferrer">
        {credit.photographer}
      </a>{' '}
      /{' '}
      <a href={UNSPLASH_HOME} target="_blank" rel="noreferrer">
        Unsplash
      </a>
    </div>
  );
}
