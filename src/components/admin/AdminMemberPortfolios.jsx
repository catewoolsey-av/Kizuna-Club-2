import React, { useState } from "react";
import { Card, Button, Input, TextArea, Select, Modal, ConfirmModal, Toast } from "../../components/ui";
import { genId } from "../../utils/random";
import { formatDate } from "../../utils/date";
import { Plus, Edit, Trash2, Save } from "lucide-react";

const AdminMemberPortfolios = ({ t, data, setData, addLog }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ memberId: "", dealId: "", amount: "", date: "", notes: "" });

  // Get all members (excluding board)
  const members = (data.members || []).filter((m) => !m.is_board);

  // All deals (fund + syndication)
  const allDeals = [...(data.fundHoldings || []), ...(data.syndicationDeals || [])];

  // Member investments stored in data.memberInvestments
  const investments = data.memberInvestments || [];

  const reset = () =>
    setForm({ memberId: "", dealId: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "" });

  const handleAdd = () => {
    if (!form.memberId || !form.dealId || !form.amount) return;
    const member = members.find((m) => m.id === form.memberId);
    const deal = allDeals.find((d) => d.id === form.dealId);

    const newInvestment = {
      id: genId(),
      memberId: form.memberId,
      memberName: member?.nameEn || member?.name,
      dealId: form.dealId,
      dealName: deal?.companyName,
      amount: form.amount,
      date: form.date,
      notes: form.notes,
    };

    setData((p) => ({ ...p, memberInvestments: [...(p.memberInvestments || []), newInvestment] }));
    addLog(
      "investmentAdded",
      `Added investment: ${member?.nameEn} → ${deal?.companyName} (${form.amount})`,
      `投資追加: ${member?.nameEn} → ${deal?.companyName}`
    );
    setShowAdd(false);
    reset();
    setToast({ message: t.savedSuccessfully, type: "success" });
  };

  const handleEdit = () => {
    if (!form.memberId || !form.dealId || !form.amount) return;
    const member = members.find((m) => m.id === form.memberId);
    const deal = allDeals.find((d) => d.id === form.dealId);

    setData((p) => ({
      ...p,
      memberInvestments: (p.memberInvestments || []).map((i) =>
        i.id === sel.id
          ? {
              ...i,
              memberId: form.memberId,
              memberName: member?.nameEn || member?.name,
              dealId: form.dealId,
              dealName: deal?.companyName,
              amount: form.amount,
              date: form.date,
              notes: form.notes,
            }
          : i
      ),
    }));
    addLog("investmentEdited", `Edited investment: ${member?.nameEn} → ${deal?.companyName} (${form.amount})`, `投資編集`);
    setShowEdit(false);
    setSel(null);
    reset();
    setToast({ message: t.savedSuccessfully, type: "success" });
  };

  const handleDel = () => {
    setData((p) => ({ ...p, memberInvestments: (p.memberInvestments || []).filter((i) => i.id !== sel.id) }));
    addLog("investmentDeleted", `Deleted investment: ${sel.memberName} → ${sel.dealName}`, `投資削除`);
    setSel(null);
    setShowDel(false);
    setToast({ message: t.deletedSuccessfully, type: "success" });
  };

  const openEdit = (inv) => {
    setSel(inv);
    setForm({
      memberId: inv.memberId || "",
      dealId: inv.dealId || "",
      amount: inv.amount || "",
      date: inv.date || "",
      notes: inv.notes || "",
    });
    setShowEdit(true);
  };

  // Group investments by member
  const investmentsByMember = {};
  investments.forEach((inv) => {
    if (!investmentsByMember[inv.memberId]) {
      investmentsByMember[inv.memberId] = {
        member: members.find((m) => m.id === inv.memberId),
        investments: [],
      };
    }
    investmentsByMember[inv.memberId].investments.push(inv);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Member Portfolios</h2>
          <p className="text-sm text-gray-500">Manage member investments in syndication deals</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => { reset(); setShowAdd(true); }}>
          Add Investment
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-2xl font-bold text-gray-900">{investments.length}</p>
          <p className="text-xs text-gray-500">Total Investments</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-gray-900">{Object.keys(investmentsByMember).length}</p>
          <p className="text-xs text-gray-500">Members Invested</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-gray-900">{new Set(investments.map((i) => i.dealId)).size}</p>
          <p className="text-xs text-gray-500">Deals with Investors</p>
        </Card>
      </div>

      {/* Investments List */}
      {investments.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">No member investments yet</p>
        </Card>
      ) : (
        <Card padding={false}>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Deal</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {investments.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.memberName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{inv.dealName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{inv.amount}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.date)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded mr-1" onClick={() => openEdit(inv)}>
                      <Edit size={16} />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => { setSel(inv); setShowDel(true); }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add Investment Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Member Investment">
        <div className="space-y-4">
          <Select
            label="Member"
            value={form.memberId}
            onChange={(v) => setForm({ ...form, memberId: v })}
            required
            options={[{ value: "", label: "Select member..." }, ...members.map((m) => ({ value: m.id, label: m.nameEn || m.name }))]}
          />
          <Select
            label="Deal"
            value={form.dealId}
            onChange={(v) => setForm({ ...form, dealId: v })}
            required
            options={[{ value: "", label: "Select deal..." }, ...allDeals.map((d) => ({ value: d.id, label: `${d.companyName} (${d.sector})` }))]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount Invested" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required placeholder="$50,000" />
            <Input label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
          </div>
          <TextArea label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Additional notes..." />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleAdd} disabled={!form.memberId || !form.dealId || !form.amount}>{t.save}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Investment Modal */}
      <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setSel(null); }} title="Edit Investment">
        <div className="space-y-4">
          <Select
            label="Member"
            value={form.memberId}
            onChange={(v) => setForm({ ...form, memberId: v })}
            required
            options={[{ value: "", label: "Select member..." }, ...members.map((m) => ({ value: m.id, label: m.nameEn || m.name }))]}
          />
          <Select
            label="Deal"
            value={form.dealId}
            onChange={(v) => setForm({ ...form, dealId: v })}
            required
            options={[{ value: "", label: "Select deal..." }, ...allDeals.map((d) => ({ value: d.id, label: `${d.companyName} (${d.sector})` }))]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount Invested" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required placeholder="$50,000" />
            <Input label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
          </div>
          <TextArea label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Additional notes..." />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEdit(false); setSel(null); }}>{t.cancel}</Button>
            <Button variant="primary" icon={Save} onClick={handleEdit} disabled={!form.memberId || !form.dealId || !form.amount}>{t.save}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDel}
        onClose={() => { setShowDel(false); setSel(null); }}
        onConfirm={handleDel}
        title="Delete Investment"
        message={`Delete ${sel?.memberName}'s investment in ${sel?.dealName}?`}
        confirmText={t.delete}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AdminMemberPortfolios;
