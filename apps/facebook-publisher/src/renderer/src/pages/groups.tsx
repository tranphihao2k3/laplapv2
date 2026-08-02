/**
 * Groups + Group Sets — UI CRUD.
 *
 * Tabs: "Nhóm" (GRP-001) | "Tập nhóm" (GRP-002).
 *
 * - Add group qua form modal (URL validate, maxImages, posting mode).
 * - Toggle enabled, edit inline, delete confirm.
 * - Sets: create / rename / addMember / removeMember / delete set.
 */
import { useEffect, useState } from "react";
import type { GroupRecord, GroupSetRecord, PostingMode } from "../../../shared/groups";

type Tab = "groups" | "sets";

export function GroupsPage() {
  const [tab, setTab] = useState<Tab>("groups");
  return (
    <section>
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Nhóm Facebook</h1>
      </header>
      <div className="mt-3 flex gap-1 border-b border-muted-100 text-sm">
        <TabButton active={tab === "groups"} onClick={() => setTab("groups")}>
          Nhóm ({countGroups()})
        </TabButton>
        <TabButton active={tab === "sets"} onClick={() => setTab("sets")}>
          Tập nhóm
        </TabButton>
      </div>
      <div className="mt-4">
        {tab === "groups" ? <GroupsPanel /> : <GroupSetsPanel />}
      </div>
    </section>
  );
}

function countGroups(): string {
  // lightweight — render-time count via subscription.
  return String(useGroupsCount());
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`border-b-2 px-3 py-1.5 ${
        props.active ? "border-primary-600 font-medium" : "border-transparent text-muted-500"
      }`}
    >
      {props.children}
    </button>
  );
}

// ----- GroupsPanel -----
function useGroupsCount(): number {
  const [items, setItems] = useState<GroupRecord[]>([]);
  useEffect(() => {
    const api = window.publisherApi;
    if (!api) return;
    void api.groupsList().then((r) => r.ok && setItems(r.data));
  }, []);
  return items.length;
}

function GroupsPanel() {
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
    if (!r.ok) setError(r.error.message);
    void load();
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded border border-danger-500 bg-danger-50 p-2 text-sm text-danger-600">
          {error}
        </p>
      )}
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Thêm nhóm
        </button>
      </div>
      <div className="overflow-hidden rounded border border-muted-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted-50 text-left text-xs uppercase text-muted-500">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Enabled</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Max ảnh</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-500">
                  Chưa có nhóm nào. Bấm "Thêm nhóm" để bắt đầu.
                </td>
              </tr>
            )}
            {items.map((g) => (
              <tr key={g.id} className="border-t border-muted-100">
                <td className="px-3 py-2">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    {g.notes && <p className="text-xs text-muted-500">{g.notes}</p>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <a className="text-primary-600 underline" href={g.url} target="_blank" rel="noreferrer">
                    {g.url}
                  </a>
                </td>
                <td className="px-3 py-2">{g.enabled ? "Bật" : "Tắt"}</td>
                <td className="px-3 py-2">{g.postingMode}</td>
                <td className="px-3 py-2">{g.maxImages}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(g)}
                    className="mr-1 rounded border border-muted-100 px-2 py-0.5 text-xs hover:bg-muted-50"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(g.id)}
                    className="rounded border border-danger-500 px-2 py-0.5 text-xs text-danger-600 hover:bg-danger-50"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          }}
          onError={setError}
        />
      )}
    </div>
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
  const [postingMode, setPostingMode] = useState<PostingMode>(props.initial?.postingMode ?? "assisted");
  const [notes, setNotes] = useState(props.initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30">
      <form
        onSubmit={onSubmit}
        className="w-96 rounded-lg border border-muted-100 bg-white p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold">{isEdit ? "Sửa nhóm" : "Thêm nhóm"}</h2>
        <label className="mt-3 block text-sm">
          <span>Tên</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span>URL Facebook</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://facebook.com/groups/<id>"
            className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label>
            <span>Max ảnh</span>
            <input
              type="number"
              min={0}
              max={50}
              value={maxImages}
              onChange={(e) => setMaxImages(Number(e.target.value))}
              className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
            />
          </label>
          <label>
            <span>Posting mode</span>
            <select
              value={postingMode}
              onChange={(e) => setPostingMode(e.target.value as PostingMode)}
              className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
            >
              <option value="assisted">assisted</option>
              <option value="auto">auto</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={allowLink} onChange={(e) => setAllowLink(e.target.checked)} />
            Cho phép link
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span>Ghi chú</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded border border-muted-100 px-2 py-1.5"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-muted-100 px-3 py-1.5 text-sm hover:bg-muted-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ----- GroupSetsPanel -----
function GroupSetsPanel() {
  const [sets, setSets] = useState<GroupSetRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupRecord[]>([]);
  const [newName, setNewName] = useState("");

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
    await api.groupSetsCreate(newName.trim());
    setNewName("");
    void reload();
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
    await api.groupSetsRemoveMember(activeSet, groupId);
    void api.groupSetsMembers(activeSet).then((r) => r.ok && setMembers(r.data));
  }

  const candidateGroups = groups.filter(
    (g) => g.enabled && !members.some((m) => m.id === g.id),
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="mb-2 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên tập nhóm…"
            className="rounded border border-muted-100 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={create}
            className="rounded bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700"
          >
            + Tạo
          </button>
        </div>
        <ul className="divide-y rounded border border-muted-100 bg-white">
          {sets.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-500">Chưa có tập nhóm.</li>
          )}
          {sets.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between px-3 py-2 text-sm ${
                activeSet === s.id ? "bg-primary-50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveSet(s.id)}
                className="flex-1 text-left hover:underline"
              >
                {s.name}
              </button>
              <button
                type="button"
                onClick={() => void deleteSet(s.id)}
                className="rounded border border-danger-500 px-2 py-0.5 text-xs text-danger-600 hover:bg-danger-50"
              >
                Xoá
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {!activeSet && (
          <p className="text-sm text-muted-500">Chọn một tập nhóm để xem thành viên.</p>
        )}
        {activeSet && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Đã thêm vào tập</h3>
              <ul className="mt-1 divide-y rounded border border-muted-100 bg-white">
                {members.length === 0 && (
                  <li className="px-3 py-3 text-center text-sm text-muted-500">Trống.</li>
                )}
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => void removeMember(m.id)}
                      className="text-xs text-danger-600 hover:underline"
                    >
                      Bỏ
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium">Thêm nhóm enabled</h3>
              <ul className="mt-1 divide-y rounded border border-muted-100 bg-white">
                {candidateGroups.length === 0 && (
                  <li className="px-3 py-3 text-center text-sm text-muted-500">
                    Không còn nhóm enabled nào để thêm.
                  </li>
                )}
                {candidateGroups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span>{g.name}</span>
                    <button
                      type="button"
                      onClick={() => void addMember(g.id)}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Thêm
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}