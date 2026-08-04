/**
 * Groups + Group Sets — UI CRUD.
 *
 * - 2 tab: "Nhóm" | "Tập nhóm".
 * - List dạng card (mỗi card = 1 group với info + actions).
 * - Toggle enabled inline (badge click).
 * - Modal form thêm/sửa có validation URL.
 *
 * Bug fix: trước `countGroups()` gọi `useGroupsCount()` trong render của
 * parent → vi phạm Rules of Hooks. Đã sửa bằng cách để parent tự fetch
 * list và đếm.
 */
import { useEffect, useState } from "react";
import type { GroupRecord, GroupSetRecord, PostingMode } from "../../../shared/groups";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
} from "../components/ui";
import {
  IconEdit,
  IconInbox,
  IconLayers,
  IconPlus,
  IconTrash,
  IconUsers,
} from "../components/ui/icons";

type Tab = "groups" | "sets";

export function GroupsPage() {
  const [tab, setTab] = useState<Tab>("groups");
  const [count, setCount] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Đếm group cho badge tab — effect này ở component cha, không vi phạm
  // Rules of Hooks.
  useEffect(() => {
    const api = window.publisherApi;
    if (!api) return;
    void api.groupsList().then((r) => r.ok && setCount(r.data.length));
  }, [reloadTrigger]);

  return (
    <section className="space-y-5">
      <PageHeader title="Nhóm Facebook" subtitle="Quản lý nhóm đăng bài và tập nhóm." />

      <div className="flex gap-1 border-b border-muted-100 text-sm" role="tablist">
        <TabButton active={tab === "groups"} onClick={() => setTab("groups")}>
          Nhóm <Badge variant="neutral" size="sm" className="ml-1">{count}</Badge>
        </TabButton>
        <TabButton active={tab === "sets"} onClick={() => setTab("sets")}>
          Tập nhóm
        </TabButton>
      </div>

      <div>
        {tab === "groups" ? (
          <GroupsPanel onChanged={() => setReloadTrigger((n) => n + 1)} />
        ) : (
          <GroupSetsPanel />
        )}
      </div>
    </section>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.active}
      onClick={props.onClick}
      className={[
        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
        props.active
          ? "border-primary-600 font-medium text-primary-700"
          : "border-transparent text-muted-500 hover:border-muted-200 hover:text-muted-800",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

// ----- GroupsPanel -----
function GroupsPanel({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<GroupRecord[]>([]);
  const [editing, setEditing] = useState<GroupRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.groupsList();
    if (r.ok) setItems(r.data);
  }
  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Xoá nhóm này? Lịch sử bài đăng vẫn được giữ.")) return;
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.groupsDelete(id);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    void load();
    onChanged();
  }

  async function toggleEnabled(g: GroupRecord) {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.groupsUpdate(g.id, { enabled: !g.enabled });
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    void load();
    onChanged();
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="flex justify-end">
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
          Thêm nhóm
        </Button>
      </div>

      {items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Chưa có nhóm nào"
            description="Thêm nhóm Facebook bạn muốn đăng bài vào. URL phải ở dạng facebook.com/groups/<id>."
            action={
              <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
                Thêm nhóm
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onEdit={() => setEditing(g)}
              onDelete={() => void handleDelete(g.id)}
              onToggleEnabled={() => void toggleEnabled(g)}
            />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <GroupForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            setError(null);
            void load();
            onChanged();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function GroupCard({
  group,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  group: GroupRecord;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}) {
  return (
    <Card padding="md" className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-muted-900" title={group.name}>
            {group.name}
          </h3>
          {group.notes && (
            <p className="mt-0.5 text-xs text-muted-500">{group.notes}</p>
          )}
        </div>
        <Badge variant={group.enabled ? "success" : "neutral"} size="sm" dot>
          {group.enabled ? "Bật" : "Tắt"}
        </Badge>
      </header>

      <a
        href={group.url}
        target="_blank"
        rel="noreferrer"
        className="block truncate rounded-md border border-muted-100 bg-muted-50/50 px-2.5 py-1.5 font-mono text-xs text-primary-600 hover:border-primary-300 hover:bg-primary-50/40"
        title={group.url}
      >
        {group.url}
      </a>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="primary" size="sm">
          {group.postingMode === "assisted" ? "Hỗ trợ" : "Tự động"}
        </Badge>
        <Badge variant="neutral" size="sm">
          Max {group.maxImages} ảnh
        </Badge>
        <Badge variant={group.allowLink ? "primary" : "neutral"} size="sm">
          {group.allowLink ? "Cho link" : "Không link"}
        </Badge>
      </div>

      <footer className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onToggleEnabled}>
          {group.enabled ? "Tắt" : "Bật"}
        </Button>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" icon={<IconEdit size={14} />} onClick={onEdit}>
            Sửa
          </Button>
          <Button variant="danger" size="sm" icon={<IconTrash size={14} />} onClick={onDelete}>
            Xoá
          </Button>
        </div>
      </footer>
    </Card>
  );
}

function GroupForm(props: {
  initial?: GroupRecord;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!props.initial;
  const [name, setName] = useState(props.initial?.name ?? "");
  const [url, setUrl] = useState(props.initial?.url ?? "");
  const [enabled, setEnabled] = useState(props.initial?.enabled ?? true);
  const [maxImages, setMaxImages] = useState(props.initial?.maxImages ?? 10);
  const [allowLink, setAllowLink] = useState(props.initial?.allowLink ?? true);
  const [postingMode, setPostingMode] = useState<PostingMode>(
    props.initial?.postingMode ?? "assisted",
  );
  const [notes, setNotes] = useState(props.initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function validateUrl(v: string): string | null {
    if (!v.trim()) return "URL không được rỗng";
    if (!/^https?:\/\/(www\.)?facebook\.com\/groups\/\S+/i.test(v)) {
      return "URL phải có dạng https://facebook.com/groups/<id>";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = validateUrl(url);
    const n = !name.trim() ? "Tên không được rỗng" : null;
    setUrlError(u);
    setNameError(n);
    if (u || n) return;
    const api = window.publisherApi;
    if (!api) return;
    setSubmitting(true);
    const r = isEdit
      ? await api.groupsUpdate(props.initial!.id, {
          name,
          url,
          enabled,
          maxImages,
          allowLink,
          postingMode,
          notes: notes || null,
        })
      : await api.groupsCreate({
          name,
          url,
          enabled,
          maxImages,
          allowLink,
          postingMode,
          notes: notes || null,
        });
    setSubmitting(false);
    if (!r.ok) {
      props.onError(r.error.message);
      return;
    }
    props.onSaved();
  }

  return (
    <Modal
      open
      onClose={props.onClose}
      title={isEdit ? "Sửa nhóm" : "Thêm nhóm"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            Huỷ
          </Button>
          <Button variant="primary" type="submit" form="group-form" loading={submitting}>
            {submitting ? "Đang lưu…" : "Lưu"}
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Tên"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          error={nameError}
          required
        />
        <Input
          label="URL Facebook"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (urlError) setUrlError(null);
          }}
          error={urlError}
          placeholder="https://facebook.com/groups/<id>"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-700">Max ảnh</span>
            <input
              type="number"
              min={0}
              max={50}
              value={maxImages}
              onChange={(e) => setMaxImages(Number(e.target.value))}
              className="block h-9 w-full rounded-md border border-muted-200 bg-white px-2.5 text-sm transition focus:border-primary-500 focus:shadow-ring focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-700">Posting mode</span>
            <select
              value={postingMode}
              onChange={(e) => setPostingMode(e.target.value as PostingMode)}
              className="block h-9 w-full rounded-md border border-muted-200 bg-white px-2.5 text-sm transition focus:border-primary-500 focus:shadow-ring focus:outline-none"
            >
              <option value="assisted">assisted (hỗ trợ)</option>
              <option value="auto">auto (tự động)</option>
            </select>
          </label>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-muted-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Enabled</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allowLink}
              onChange={(e) => setAllowLink(e.target.checked)}
              className="h-4 w-4 rounded border-muted-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Cho phép link</span>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-700">Ghi chú</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-muted-200 bg-white px-2.5 py-2 text-sm transition focus:border-primary-500 focus:shadow-ring focus:outline-none"
          />
        </label>
      </form>
    </Modal>
  );
}

// ----- GroupSetsPanel -----
function GroupSetsPanel() {
  const [sets, setSets] = useState<GroupSetRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupRecord[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function reload() {
    const api = window.publisherApi;
    if (!api) return;
    const [r1, r2] = await Promise.all([api.groupSetsList(), api.groupsList()]);
    if (r1.ok) setSets(r1.data);
    if (r2.ok) setGroups(r2.data);
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const api = window.publisherApi;
    if (!api || !activeSet) return;
    void api.groupSetsMembers(activeSet).then((r) => r.ok && setMembers(r.data));
  }, [activeSet]);

  async function create() {
    const api = window.publisherApi;
    if (!api || !newName.trim()) return;
    setCreating(true);
    await api.groupSetsCreate(newName.trim());
    setNewName("");
    void reload();
    setCreating(false);
  }

  async function deleteSet(id: string) {
    if (!window.confirm("Xoá tập nhóm? Các nhóm con vẫn còn.")) return;
    const api = window.publisherApi;
    if (!api) return;
    await api.groupSetsDelete(id);
    if (activeSet === id) setActiveSet(null);
    void reload();
  }

  async function addMember(groupId: string) {
    const api = window.publisherApi;
    if (!api || !activeSet) return;
    await api.groupSetsAddMember(activeSet, groupId);
    void api.groupSetsMembers(activeSet).then((r) => r.ok && setMembers(r.data));
  }

  async function removeMember(groupId: string) {
    const api = window.publisherApi;
    if (!api || !activeSet) return;
    await api.groupSetsAddMember(activeSet, groupId);
    void api.groupSetsRemoveMember(activeSet, groupId);
    void api.groupSetsMembers(activeSet).then((r) => r.ok && setMembers(r.data));
  }

  const candidateGroups = groups.filter(
    (g) => g.enabled && !members.some((m) => m.id === g.id),
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px,1fr]">
      <div className="space-y-2">
        <Card padding="sm">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              placeholder="Tên tập nhóm…"
              className="flex-1"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => void create()}
              loading={creating}
              disabled={!newName.trim()}
            >
              Tạo
            </Button>
          </div>
        </Card>

        {sets.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<IconLayers size={22} />}
              title="Chưa có tập nhóm"
              description="Tạo tập nhóm để gom các nhóm cùng đăng 1 chiến dịch."
            />
          </Card>
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-muted-100">
              {sets.map((s) => (
                <li
                  key={s.id}
                  className={[
                    "flex items-center justify-between px-3 py-2.5 text-sm transition",
                    activeSet === s.id ? "bg-primary-50" : "hover:bg-muted-50",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSet(s.id)}
                    className="flex-1 text-left font-medium text-muted-900 focus-visible:outline-none focus-visible:shadow-ring"
                  >
                    {s.name}
                  </button>
                  <Button variant="ghost" size="sm" icon={<IconTrash size={14} />} onClick={() => void deleteSet(s.id)}>
                    Xoá
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div>
        {!activeSet ? (
          <Card padding="none">
            <EmptyState
              icon={<IconInbox size={22} />}
              title="Chọn một tập nhóm"
              description="Chọn tập nhóm bên trái để xem và quản lý thành viên."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card padding="md">
              <h3 className="mb-2 text-sm font-semibold text-muted-900">
                Đã thêm vào tập ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="rounded-md border border-dashed border-muted-200 p-4 text-center text-xs text-muted-500">
                  Trống.
                </p>
              ) : (
                <ul className="divide-y divide-muted-100 rounded-md border border-muted-100">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="truncate">{m.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => void removeMember(m.id)}>
                        Bỏ
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="md">
              <h3 className="mb-2 text-sm font-semibold text-muted-900">
                Thêm nhóm enabled ({candidateGroups.length})
              </h3>
              {candidateGroups.length === 0 ? (
                <p className="rounded-md border border-dashed border-muted-200 p-4 text-center text-xs text-muted-500">
                  Không còn nhóm enabled nào để thêm.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-muted-100 overflow-y-auto rounded-md border border-muted-100">
                  {candidateGroups.map((g) => (
                    <li key={g.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="truncate">{g.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => void addMember(g.id)}>
                        Thêm
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}