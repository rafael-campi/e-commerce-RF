import { useMemo, useState, type CSSProperties } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useDevice } from '../lib/device';
import { artFor, brl, lead, stockInfo } from '../lib/format';
import type { Product } from '../lib/types';
import {
  Alert,
  Art,
  Field,
  LoadError,
  Skel,
  StateBlock,
  Stepper,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { Header } from './Header';
import { defaultCartId, useAddToCart, useCarts, useProducts } from './queries';

/** `preview` desliga as ações (usado na página Design System, sem API). */
export function ProductCard({
  product: p,
  hover,
  preview,
}: {
  product: Product;
  hover?: boolean;
  preview?: boolean;
}) {
  const mobile = useDevice() === 'mobile';
  const navigate = useNavigate();
  const carts = useCarts(!preview);
  const add = useAddToCart();
  const s = stockInfo(p);
  const art = artFor(p.id);
  const out = p.stock === 0;
  const busy = add.isPending;

  return (
    <article
      className={`pcard${out ? ' is-out' : ''}${hover ? ' is-hover' : ''}`}
    >
      <button
        className="art"
        style={{ '--tone': art.tone, aspectRatio: '4/3' } as CSSProperties}
        onClick={() => !preview && navigate(`/produtos/${p.id}`)}
        aria-label={`Ver ${p.name}`}
      >
        <Icon name={art.icon} size={mobile ? 36 : 48} />
      </button>
      <div className="pcard-body">
        <span className={`badge b-${s.cls}`}>{s.label}</span>
        <h3 className="pcard-name">
          <Link to={`/produtos/${p.id}`}>{p.name}</Link>
        </h3>
        <p className="pcard-desc">{p.description}</p>
        <strong className="price">{brl(p.price)}</strong>
        <span className="inst">
          ou 3× de {brl(Number(p.price) / 3)} no cartão
        </span>
        <button
          className={`btn btn-primary btn-block${busy ? ' is-loading' : ''}`}
          disabled={out}
          onClick={() =>
            !preview &&
            add.mutate({
              product: p,
              quantity: 1,
              cartId: defaultCartId(carts.data),
            })
          }
        >
          {out ? (
            'Esgotado'
          ) : (
            <>
              <Icon name="cart" size={18} />
              Adicionar ao carrinho
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export function ProductCardSkel() {
  const mobile = useDevice() === 'mobile';
  return (
    <div className="pcard" aria-hidden="true">
      <div className="skel" style={{ aspectRatio: '4/3', borderRadius: 0 }} />
      <div className="pcard-body">
        <Skel w="40%" h={20} r={999} />
        <Skel w="85%" h={16} />
        <Skel w="65%" h={14} />
        <Skel w="35%" h={22} />
        <Skel w="100%" h={mobile ? 38 : 44} r={10} />
      </div>
    </div>
  );
}

type Sort = 'relevancia' | 'menor' | 'maior' | 'nome';

function sortProducts(list: Product[], sort: Sort) {
  const l = [...list];
  if (sort === 'menor') l.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'maior') l.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === 'nome') l.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  // relevância: disponíveis primeiro, na ordem do catálogo
  if (sort === 'relevancia')
    l.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
  return l;
}

export function ProductsPage() {
  const mobile = useDevice() === 'mobile';
  const [params, setParams] = useSearchParams();
  const q = params.get('busca') ?? '';
  const [sort, setSort] = useState<Sort>('relevancia');
  const products = useProducts();

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const found = (products.data ?? []).filter(
      (p) => !term || `${p.name} ${p.description}`.toLowerCase().includes(term),
    );
    return sortProducts(found, sort);
  }, [products.data, q, sort]);

  const setQuery = (value: string) =>
    setParams(value ? { busca: value } : {}, { replace: true });

  let count = `${list.length} ${list.length === 1 ? 'produto' : 'produtos'}${q ? ` para “${q}”` : ''}`;
  if (products.isPending) count = 'Carregando produtos…';
  if (products.isError) count = 'Catálogo indisponível';

  return (
    <>
      <Header />
      <main className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h1 className="h1">Produtos</h1>
            <p className="muted" aria-live="polite">
              {count}
            </p>
          </div>
          <div className="sel-inline">
            <label htmlFor="sort">Ordenar por</label>
            <div className="ctl">
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="relevancia">Relevância</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
                <option value="nome">Nome (A–Z)</option>
              </select>
              <Icon name="chevron-down" size={16} className="ctl-caret" />
            </div>
          </div>
        </div>
        {mobile && (
          <form onSubmit={(e) => e.preventDefault()}>
            <Field
              id="busca-p"
              label={<span className="sr">Buscar produtos</span>}
              icon="search"
              placeholder="Buscar produtos"
              value={q}
              onChange={setQuery}
            />
          </form>
        )}
        <div className="strip">
          <Icon name="pix" size={18} />
          <span>
            Pague com Pix e tenha aprovação na hora. No cartão, parcele em até
            3× sem juros.
          </span>
        </div>
        {products.isPending ? (
          <div className="grid" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkel key={i} />
            ))}
          </div>
        ) : products.isError ? (
          <LoadError
            what="os produtos"
            code="GET /products"
            onRetry={() => products.refetch()}
          />
        ) : !list.length ? (
          <StateBlock
            icon="search-x"
            title={
              q ? `Nenhum produto para “${q}”` : 'Nenhum produto encontrado'
            }
            boxed
            actions={
              q && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setQuery('')}
                >
                  Limpar busca
                </button>
              )
            }
          >
            Confira a grafia ou tente um termo mais curto, como “fone” ou
            “caneca”.
          </StateBlock>
        ) : (
          <div className="grid">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export function ProductDetailPage() {
  const rawId = useParams().id;
  const id = Number(rawId);
  const mobile = useDevice() === 'mobile';
  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.product(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: (n, error) =>
      !(error instanceof ApiError && error.status < 500) && n < 2,
  });
  const carts = useCarts();
  const add = useAddToCart();
  const [qty, setQty] = useState(1);
  const [target, setTarget] = useState<number | 'novo' | null>(null);

  const p = product.data;
  const notFound =
    !Number.isInteger(id) ||
    id <= 0 ||
    (product.error instanceof ApiError && product.error.status < 500);

  if (notFound)
    return (
      <>
        <Header />
        <main className="page">
          <Link className="back" to="/produtos">
            <Icon name="arrow-left" size={18} />
            Voltar para produtos
          </Link>
          <StateBlock
            tone="warning"
            icon="search-x"
            code={`GET /products/${rawId} · 404`}
            title="Produto não encontrado"
            boxed
            actions={
              <Link className="btn btn-primary" to="/produtos">
                Ver todos os produtos
              </Link>
            }
          >
            Este produto não existe ou foi removido do catálogo. Veja outros
            itens disponíveis.
          </StateBlock>
        </main>
      </>
    );

  if (product.isError)
    return (
      <>
        <Header />
        <main className="page">
          <LoadError
            what="o produto"
            code={`GET /products/${id}`}
            onRetry={() => product.refetch()}
          />
        </main>
      </>
    );

  if (!p)
    return (
      <>
        <Header />
        <main className="page">
          <Skel w="180px" h={16} />
          <div className="pd">
            <div
              className="skel"
              style={{ aspectRatio: '1/1', borderRadius: 20 }}
            />
            <div className="pd-info">
              <Skel w="30%" h={22} r={999} />
              <Skel w="80%" h={36} />
              <Skel w="40%" h={40} />
              <Skel w="100%" h={14} />
              <div className="skel" style={{ height: 190, borderRadius: 14 }} />
            </div>
          </div>
        </main>
      </>
    );

  const si = stockInfo(p);
  const out = p.stock === 0;
  const max = Math.max(1, p.stock);
  const q = Math.min(Math.max(1, qty), max);
  const cartId = target ?? defaultCartId(carts.data);

  return (
    <>
      <Header />
      <main className="page">
        <nav className="crumbs" aria-label="Você está em">
          <Link to="/produtos">Produtos</Link>
          <Icon name="chevron-right" size={14} />
          <span>{p.name}</span>
        </nav>
        <div className="pd">
          <Art productId={p.id} size={mobile ? 96 : 140} className="pd-art" />
          <div className="pd-info">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className={`badge b-${si.cls}`}>{si.label}</span>
              <h1 className="h1">{p.name}</h1>
              <p className="body-l muted">{lead(p.description)}</p>
            </div>
            <div>
              <div className="price pd-price">{brl(p.price)}</div>
              <p className="faint">
                ou 3× de {brl(Number(p.price) / 3)} sem juros no cartão
              </p>
            </div>
            <div className="buybox">
              {out ? (
                <Alert tone="warning" title="Produto esgotado">
                  Este item está sem estoque no momento. Você pode continuar
                  comprando outros produtos.
                </Alert>
              ) : (
                <>
                  <p className="small faint">
                    <b className="num" style={{ color: 'var(--text)' }}>
                      {p.stock}
                    </b>{' '}
                    {p.stock === 1
                      ? 'unidade disponível'
                      : 'unidades disponíveis'}
                  </p>
                  <div className="buy-row">
                    <div className="field">
                      <span style={{ fontWeight: 500 }}>Quantidade</span>
                      <Stepper
                        value={q}
                        max={max}
                        onChange={(n) => setQty(Math.min(Math.max(1, n), max))}
                      />
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 170 }}>
                      <label htmlFor="alvo">Adicionar ao</label>
                      <div className="ctl">
                        <select
                          id="alvo"
                          value={String(cartId)}
                          onChange={(e) =>
                            setTarget(
                              e.target.value === 'novo'
                                ? 'novo'
                                : Number(e.target.value),
                            )
                          }
                        >
                          {(carts.data ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              Carrinho #{c.id}
                            </option>
                          ))}
                          <option value="novo">Novo carrinho</option>
                        </select>
                        <Icon
                          name="chevron-down"
                          size={16}
                          className="ctl-caret"
                        />
                      </div>
                    </div>
                  </div>
                  {q >= max && (
                    <p className="help">
                      <Icon name="info" size={14} />
                      <span>Você selecionou todo o estoque disponível.</span>
                    </p>
                  )}
                </>
              )}
              <button
                className={`btn btn-primary btn-lg btn-block${add.isPending ? ' is-loading' : ''}`}
                disabled={out}
                onClick={() =>
                  add.mutate(
                    { product: p, quantity: q, cartId },
                    { onSuccess: (cart) => setTarget(cart.id) },
                  )
                }
              >
                {out ? (
                  'Esgotado'
                ) : (
                  <>
                    <Icon name="cart" size={20} />
                    Adicionar ao carrinho · {brl(Number(p.price) * q)}
                  </>
                )}
              </button>
              {out && (
                <Link className="btn btn-secondary btn-block" to="/produtos">
                  Ver outros produtos
                </Link>
              )}
            </div>
            <div className="perks">
              <div className="perk">
                <Icon name="pix" size={18} />
                <span>Pix ou cartão de crédito, com confirmação na hora</span>
              </div>
              <div className="perk">
                <Icon name="package" size={18} />
                <span>Estoque reservado só quando o pagamento é aprovado</span>
              </div>
            </div>
            <hr className="divider" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="h4">Descrição</h2>
              <p className="muted" style={{ maxWidth: '62ch' }}>
                {p.description}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
