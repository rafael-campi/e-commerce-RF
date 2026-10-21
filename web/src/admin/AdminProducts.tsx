import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useDevice } from '../lib/device';
import { brl, parsePrice, stockInfo } from '../lib/format';
import type { Product } from '../lib/types';
import {
  Alert,
  Art,
  Field,
  LoadError,
  Modal,
  StateBlock,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { useProducts } from '../store/queries';
import { AdminShell, TableSkel } from './AdminShell';

type Editing = { mode: 'novo' } | { mode: 'editar'; product: Product };

function ProductForm({
  editing,
  onClose,
}: {
  editing: Editing;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const initial = editing.mode === 'editar' ? editing.product : null;
  const [v, setV] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    price: initial ? Number(initial.price).toFixed(2).replace('.', ',') : '',
    stock: initial ? String(initial.stock) : '',
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof typeof v | 'conflict', string>>
  >({});
  const set = (k: keyof typeof v) => (value: string) =>
    setV({ ...v, [k]: value });

  const save = useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      price: number;
      stock: number;
    }) =>
      initial ? api.updateProduct(initial.id, data) : api.createProduct(data),
    onSuccess: async (product) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
      toast(
        'success',
        initial ? 'Alterações salvas' : 'Produto criado',
        `${product.name} · ${brl(product.price)} · ${product.stock} em estoque`,
      );
    },
    onError: (error, data) => {
      if (error instanceof ApiError && error.status === 409)
        setErrors({
          name: 'Já existe um produto com este nome. Escolha outro.',
          conflict: `O catálogo já tem um produto chamado “${data.name}”. Use um nome diferente.`,
        });
      else toast('error', 'Não foi possível salvar', error.message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = v.name.trim();
    const price = parsePrice(v.price);
    const stock = v.stock.trim();
    const er: typeof errors = {};
    if (!name) er.name = 'Informe o nome do produto.';
    if (!v.price.trim()) er.price = 'Informe o preço.';
    else if (price === null)
      er.price = 'Use um valor ≥ 0 com até 2 casas decimais, como 129,90.';
    if (!stock) er.stock = 'Informe o estoque.';
    else if (!/^\d+$/.test(stock))
      er.stock = 'Use um número inteiro ≥ 0, sem vírgula.';
    setErrors(er);
    if (Object.keys(er).length) return;
    save.mutate({
      name,
      description: v.description.trim(),
      price: price!,
      stock: Number(stock),
    });
  };

  const busy = save.isPending;
  return (
    <Modal
      label={initial ? 'Editar produto' : 'Novo produto'}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="m-head">
          <div className="grow">
            <h2 className="h3">
              {initial ? 'Editar produto' : 'Novo produto'}
            </h2>
            <p className="muted">
              {initial
                ? `ID #${initial.id}`
                : 'Os campos com * são obrigatórios.'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="m-body">
          {errors.conflict && (
            <Alert tone="danger" title="Nome já cadastrado (409)">
              {errors.conflict}
            </Alert>
          )}
          <Field
            id="pf-nome"
            label="Nome *"
            placeholder="Ex.: Luminária de Mesa Arco"
            value={v.name}
            onChange={set('name')}
            error={errors.name}
            help="Precisa ser único no catálogo."
            disabled={busy}
          />
          <Field
            id="pf-desc"
            label="Descrição"
            placeholder="Destaque material, tamanho e uso"
            value={v.description}
            onChange={set('description')}
            area
            disabled={busy}
          />
          <div className="row2">
            <Field
              id="pf-preco"
              label="Preço (R$) *"
              placeholder="0,00"
              value={v.price}
              onChange={set('price')}
              error={errors.price}
              help="Valor ≥ 0, com até 2 casas."
              disabled={busy}
            />
            <Field
              id="pf-estoque"
              label="Estoque *"
              placeholder="0"
              value={v.stock}
              onChange={set('stock')}
              error={errors.stock}
              help="Número inteiro ≥ 0."
              disabled={busy}
            />
          </div>
        </div>
        <div className="m-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`btn btn-primary${busy ? ' is-loading' : ''}`}
          >
            {initial ? 'Salvar alterações' : 'Criar produto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveProduct({
  product,
  onClose,
  onZeroStock,
}: {
  product: Product;
  onClose: () => void;
  onZeroStock: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [inCart, setInCart] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.deleteProduct(product.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
      toast('success', 'Produto removido', `${product.name} saiu do catálogo.`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setInCart(true);
      else toast('error', 'Não foi possível remover', error.message);
    },
  });

  return (
    <Modal
      small
      label={
        inCart
          ? 'Não é possível remover este produto'
          : `Remover ${product.name}`
      }
      onClose={onClose}
    >
      <div className="m-head">
        <div className={`m-ic ${inCart ? 'warn' : 'danger'}`}>
          <Icon name={inCart ? 'alert-triangle' : 'trash'} size={22} />
        </div>
        <div className="grow">
          <h2 className="h3">
            {inCart
              ? 'Não é possível remover este produto'
              : `Remover “${product.name}”?`}
          </h2>
          {!inCart && (
            <p className="muted">
              O produto sai do catálogo e não poderá ser comprado.
            </p>
          )}
        </div>
      </div>
      {inCart && (
        <div className="m-body">
          <Alert tone="warning" title="Produto em carrinhos (409)">
            “{product.name}” está em carrinhos de clientes. Ele só pode ser
            removido quando não estiver em nenhum carrinho.
          </Alert>
          <p className="small faint">
            Para tirá-lo da vitrine agora, edite o produto e zere o estoque. Ele
            aparece como “Esgotado” e ninguém consegue comprá-lo.
          </p>
        </div>
      )}
      <div className="m-foot" style={inCart ? undefined : { border: 0 }}>
        {inCart ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Fechar
            </button>
            <button className="btn btn-primary" onClick={onZeroStock}>
              Zerar estoque
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              className={`btn btn-danger${remove.isPending ? ' is-loading' : ''}`}
              onClick={() => remove.mutate()}
            >
              Remover produto
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function AdminProductsPage() {
  const mobile = useDevice() === 'mobile';
  const products = useProducts();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<Product | null>(null);
  const [params, setParams] = useSearchParams();

  // /admin/produtos?editar=3 abre a edição direto (botão "Repor" do dashboard)
  const editId = Number(params.get('editar'));
  useEffect(() => {
    const product = products.data?.find((p) => p.id === editId);
    if (!product) return;
    setEditing({ mode: 'editar', product });
    setParams({}, { replace: true });
  }, [editId, products.data, setParams]);

  const all = products.data ?? [];
  const term = q.trim().toLowerCase();
  const list = all.filter((p) => !term || p.name.toLowerCase().includes(term));
  const newButton = (
    <button
      className="btn btn-primary"
      onClick={() => setEditing({ mode: 'novo' })}
    >
      <Icon name="plus" size={18} />
      Novo produto
    </button>
  );

  let body;
  if (products.isPending) body = <TableSkel cols={4} rows={6} />;
  else if (products.isError)
    body = (
      <LoadError
        what="os produtos"
        code="GET /products"
        onRetry={() => products.refetch()}
      />
    );
  else if (!list.length)
    body = (
      <StateBlock
        tone="brand"
        icon="package"
        title={
          term ? `Nenhum produto para “${q}”` : 'Nenhum produto cadastrado'
        }
        boxed
        actions={newButton}
      >
        {term
          ? 'Tente outro nome.'
          : 'Cadastre o primeiro produto para ele aparecer na vitrine.'}
      </StateBlock>
    );
  else if (mobile)
    body = (
      <div className="panel mlist">
        {list.map((p) => {
          const si = stockInfo(p);
          return (
            <div className="mrow" key={p.id}>
              <Art productId={p.id} size={22} className="thumb" />
              <div className="grow">
                <b>{p.name}</b>
                <span className="small faint num">
                  {brl(p.price)} · {p.stock} un.
                </span>
                <br />
                <span className={`badge b-${si.cls}`} style={{ marginTop: 4 }}>
                  {si.label}
                </span>
              </div>
              <button
                className="icon-btn sm"
                onClick={() => setEditing({ mode: 'editar', product: p })}
                aria-label={`Editar ${p.name}`}
              >
                <Icon name="pencil" size={18} />
              </button>
              <button
                className="icon-btn sm danger"
                onClick={() => setRemoving(p)}
                aria-label={`Remover ${p.name}`}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          );
        })}
      </div>
    );
  else
    body = (
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="r">Preço</th>
              <th className="r">Estoque</th>
              <th>Situação</th>
              <th className="r">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const si = stockInfo(p);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="c-prod">
                      <Art productId={p.id} size={20} className="thumb" />
                      <div style={{ minWidth: 0 }}>
                        <b>{p.name}</b>
                        <span className="small faint">{p.description}</span>
                      </div>
                    </div>
                  </td>
                  <td className="r num">{brl(p.price)}</td>
                  <td className="r num">{p.stock}</td>
                  <td>
                    <span className={`badge b-${si.cls}`}>{si.label}</span>
                  </td>
                  <td>
                    <div className="acts">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setEditing({ mode: 'editar', product: p })
                        }
                      >
                        <Icon name="pencil" size={16} />
                        Editar
                      </button>
                      <button
                        className="icon-btn sm danger"
                        onClick={() => setRemoving(p)}
                        aria-label={`Remover ${p.name}`}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <AdminShell crumb="Produtos">
      <div className="dash-head">
        <div>
          <h1 className="h1">Produtos</h1>
          <p className="muted">
            {products.isPending
              ? 'Carregando…'
              : `${all.length} produtos no catálogo · ${all.filter((p) => p.stock <= 5).length} com estoque baixo`}
          </p>
        </div>
        {newButton}
      </div>
      <div className="filters">
        <form
          style={{ flex: 1, maxWidth: 380 }}
          onSubmit={(e) => e.preventDefault()}
        >
          <Field
            id="abusca"
            label={<span className="sr">Buscar produto</span>}
            icon="search"
            placeholder="Buscar por nome"
            value={q}
            onChange={setQ}
          />
        </form>
      </div>
      {body}
      {editing && (
        <ProductForm editing={editing} onClose={() => setEditing(null)} />
      )}
      {removing && (
        <RemoveProduct
          product={removing}
          onClose={() => setRemoving(null)}
          onZeroStock={() => {
            setRemoving(null);
            setEditing({ mode: 'editar', product: { ...removing, stock: 0 } });
          }}
        />
      )}
    </AdminShell>
  );
}
