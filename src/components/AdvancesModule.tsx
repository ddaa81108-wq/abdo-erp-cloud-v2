import React, { useState, useEffect, useRef } from "react";
import { ERPState, AdvancePerson, AdvanceTransaction, NoteReminder } from "../types";
import { Plus, Minus, Search, Trash2, Calendar, Edit3, X, History, Save, Bell, CheckCircle } from "lucide-react";

interface AdvancesModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  searchQuery?: string;
}

const AdvancesModule: React.FC<AdvancesModuleProps> = ({ state, onUpdateState, searchQuery = "" }) => {
  // --- Section: Diaries and Reminders ---
  const [newNoteText, setNewNoteText] = useState("");
  const [isReminder, setIsReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState("");

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote: NoteReminder = {
      id: `note_${Date.now()}`,
      text: newNoteText.trim(),
      date: new Date().toISOString(),
      isReminder,
      ...(isReminder && { reminderDate }),
      isCompleted: false,
    };

    onUpdateState({
      ...state,
      notesAndReminders: [newNote, ...(state.notesAndReminders || [])],
    });

    setNewNoteText("");
    setIsReminder(false);
    setReminderDate("");
  };

  const toggleNoteComplete = (noteId: string) => {
    onUpdateState({
      ...state,
      notesAndReminders: (state.notesAndReminders || []).map(n => 
        n.id === noteId ? { ...n, isCompleted: !n.isCompleted } : n
      )
    });
  };

  const deleteNote = (noteId: string) => {
    if(!window.confirm("تأكيد حذف الملاحظة؟")) return;
    onUpdateState({
      ...state,
      notesAndReminders: (state.notesAndReminders || []).filter(n => n.id !== noteId)
    });
  };

  // Check reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      (state.notesAndReminders || []).forEach(note => {
        if (note.isReminder && !note.isCompleted && note.reminderDate) {
          const remDate = new Date(note.reminderDate);
          // If we passed the reminder date and it hasn't been alerted today (simple check)
          if (now >= remDate) {
            // we could alert here or just highlight it
          }
        }
      });
    };
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [state.notesAndReminders]);

  // --- Section: Advances (Cards System) ---
  const [newPersonName, setNewPersonName] = useState("");
  
  const [selectedPerson, setSelectedPerson] = useState<AdvancePerson | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);

  // Transaction form inside modal
  const [txType, setTxType] = useState<"add" | "repay">("add");
  const [txAmount, setTxAmount] = useState("");
  const [txCurrency, setTxCurrency] = useState<"LYD" | "EGP">("LYD");
  const [txNote, setTxNote] = useState("");
  
  const amountInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    const newPerson: AdvancePerson = {
      id: `adv_person_${Date.now()}`,
      name: newPersonName.trim(),
      balanceLYD: 0,
      balanceEGP: 0,
    };

    onUpdateState({
      ...state,
      advancePersons: [newPerson, ...(state.advancePersons || [])],
    });

    setNewPersonName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;
    
    // Parse to int, ensure no decimals
    const amt = parseInt(txAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      alert("الرجاء إدخال مبلغ صحيح وموجب.");
      return;
    }

    const newTx: AdvanceTransaction = {
      id: `adv_tx_${Date.now()}`,
      personId: selectedPerson.id,
      type: txType,
      amount: amt,
      currency: txCurrency,
      date: new Date().toISOString(),
      note: txNote.trim()
    };

    let balDelta = txType === "add" ? amt : -amt;

    const updatedPersons = (state.advancePersons || []).map(p => {
      if (p.id === selectedPerson.id) {
        return {
          ...p,
          balanceLYD: txCurrency === "LYD" ? p.balanceLYD + balDelta : p.balanceLYD,
          balanceEGP: txCurrency === "EGP" ? p.balanceEGP + balDelta : p.balanceEGP,
        };
      }
      return p;
    });

    onUpdateState({
      ...state,
      advancePersons: updatedPersons,
      advanceTransactions: [newTx, ...(state.advanceTransactions || [])],
    });

    // Reset tx form
    setTxAmount("");
    setTxNote("");
    
    // update local selected person ref
    setSelectedPerson(updatedPersons.find(p => p.id === selectedPerson.id) || null);
  };

  const handleDeletePerson = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!window.confirm("تحذير: سيتم حذف هذا الشخص وسجلاته بالكامل. هل أنت متأكد؟")) return;

    onUpdateState({
      ...state,
      advancePersons: (state.advancePersons || []).filter(p => p.id !== id),
      advanceTransactions: (state.advanceTransactions || []).filter(tx => tx.personId !== id)
    });
  };

  // Filter persons
  const filteredPersons = (state.advancePersons || []).filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPersonTxs = (personId: string) => {
    return (state.advanceTransactions || [])
      .filter(t => t.personId === personId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-slate-50 min-h-full" dir="rtl">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <span className="bg-indigo-100 p-2 rounded-xl text-indigo-600">💸</span>
            العهد والسلفيات واليوميات
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            مساحة معزولة 100% عن الخزينة لإدارة الملاحظات وسلف الموظفين. الأرقام صحيحة فقط بدون كسور.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUMN 1: Diaries & Reminders */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              ملاحظات وتنبيهات
            </h2>
            
            <form onSubmit={handleAddNote} className="space-y-4 mb-6">
              <div>
                <input
                  type="text"
                  placeholder="اكتب ملاحظة..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReminder}
                    onChange={(e) => setIsReminder(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  جدولة كتنبيه
                </label>
                {isReminder && (
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm outline-none"
                    required
                  />
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                إضافة
              </button>
            </form>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {(state.notesAndReminders || []).map(note => {
                const isOverdue = note.isReminder && new Date(note.reminderDate || "") <= new Date() && !note.isCompleted;
                return (
                  <div key={note.id} className={`p-4 rounded-xl border flex items-start gap-3 transition ${note.isCompleted ? 'bg-slate-50 border-slate-200 opacity-60' : isOverdue ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <button onClick={() => toggleNoteComplete(note.id)} className="mt-0.5 text-slate-400 hover:text-emerald-500">
                      <CheckCircle className={`w-5 h-5 ${note.isCompleted ? 'text-emerald-500' : ''}`} />
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${note.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                        {note.text}
                      </p>
                      {note.isReminder && (
                        <p className={`text-xs mt-1 flex items-center gap-1 font-bold ${isOverdue && !note.isCompleted ? 'text-rose-600' : 'text-indigo-600'}`}>
                          <Bell className="w-3 h-3" />
                          {new Date(note.reminderDate!).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteNote(note.id)} className="text-slate-400 hover:text-rose-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {!(state.notesAndReminders?.length) && (
                <p className="text-center text-slate-400 text-sm py-4">لا توجد ملاحظات</p>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2 & 3: Advances Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                سجل السلفيات والعهد
              </h2>
            </div>

            <form onSubmit={handleAddPerson} className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="إضافة شخص جديد..."
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                required
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 rounded-xl text-sm transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPersons.map(person => (
                <div 
                  key={person.id}
                  onClick={() => { setSelectedPerson(person); setShowPersonModal(true); }}
                  className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 cursor-pointer transition shadow-sm hover:shadow-md relative group"
                >
                  <button 
                    onClick={(e) => handleDeletePerson(person.id, e)}
                    className="absolute top-4 left-4 p-1.5 bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <h3 className="font-black text-slate-800 text-lg mb-3">{person.name}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-xs font-bold text-slate-500">الرصيد (ليبي)</span>
                      <span className={`font-black ${person.balanceLYD > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {person.balanceLYD.toLocaleString('en-US')} د.ل
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-xs font-bold text-slate-500">الرصيد (مصري)</span>
                      <span className={`font-black ${person.balanceEGP > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {person.balanceEGP.toLocaleString('en-US')} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredPersons.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-400 font-medium">
                  لا توجد عهد أو سلفيات مسجلة.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Person Detail Modal */}
      {showPersonModal && selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800">
                كشف سلفيات: {selectedPerson.name}
              </h2>
              <button
                onClick={() => setShowPersonModal(false)}
                className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition shadow-sm border border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
              
              {/* Form Side */}
              <div className="lg:w-1/3 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600">إجمالي السلفة (ليبي)</span>
                    <span className="font-black text-lg text-rose-600">{selectedPerson.balanceLYD.toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600">إجمالي السلفة (مصري)</span>
                    <span className="font-black text-lg text-indigo-600">{selectedPerson.balanceEGP.toLocaleString('en-US')}</span>
                  </div>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTxType("add")}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${txType === 'add' ? 'bg-rose-500 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      إضافة سلفة
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType("repay")}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${txType === 'repay' ? 'bg-emerald-500 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      سداد / خصم
                    </button>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTxCurrency("LYD")}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${txCurrency === 'LYD' ? 'bg-white text-indigo-600 shadow border border-indigo-100' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      دينار ليبي
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxCurrency("EGP")}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${txCurrency === 'EGP' ? 'bg-white text-indigo-600 shadow border border-indigo-100' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      جنيه مصري
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (أرقام صحيحة فقط)</label>
                    <input
                      ref={amountInputRef}
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      onKeyDown={(e) => handleKeyDown(e, noteInputRef)}
                      placeholder="مثال: 500"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-lg font-black text-left focus:ring-2 focus:ring-indigo-500 outline-none"
                      style={{ MozAppearance: 'textfield' }} // Hide spinner Firefox
                    />
                    <style>{`input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }`}</style>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة / بيان</label>
                    <input
                      ref={noteInputRef}
                      type="text"
                      required
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      placeholder="تفاصيل العملية..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    حفظ العملية
                  </button>
                </form>
              </div>

              {/* Ledger Side */}
              <div className="lg:w-2/3 border-t lg:border-t-0 lg:border-r border-slate-200 lg:pr-8 pt-8 lg:pt-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-indigo-500" />
                  سجل العمليات
                </h3>
                
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">النوع</th>
                          <th className="p-3">البيان</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">العملة</th>
                          <th className="p-3">الرصيد التراكمي للعملة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const txs = getPersonTxs(selectedPerson.id);
                          let runningLYD = 0;
                          let runningEGP = 0;
                          
                          if (txs.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">
                                  لا توجد عمليات مسجلة حتى الآن.
                                </td>
                              </tr>
                            );
                          }

                          return txs.map(tx => {
                            if (tx.currency === "LYD") {
                              runningLYD += tx.type === "add" ? tx.amount : -tx.amount;
                            } else {
                              runningEGP += tx.type === "add" ? tx.amount : -tx.amount;
                            }
                            const isAdd = tx.type === "add";
                            return (
                              <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                <td className="p-3 whitespace-nowrap text-xs font-bold text-slate-500">
                                  {new Date(tx.date).toLocaleDateString("en-GB")}
                                  <span className="block text-[10px] text-slate-400">
                                    {new Date(tx.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${isAdd ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {isAdd ? 'سلفة' : 'سداد'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-700 font-medium max-w-[150px] truncate" title={tx.note}>
                                  {tx.note}
                                </td>
                                <td className="p-3 font-black text-left" dir="ltr">
                                  <span className={isAdd ? 'text-rose-600' : 'text-emerald-600'}>
                                    {isAdd ? '+' : '-'}{tx.amount.toLocaleString('en-US')}
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-slate-600">
                                  {tx.currency === "LYD" ? "د.ل" : "ج.م"}
                                </td>
                                <td className="p-3 font-black text-left" dir="ltr">
                                  {tx.currency === "LYD" ? runningLYD.toLocaleString('en-US') : runningEGP.toLocaleString('en-US')}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdvancesModule;
