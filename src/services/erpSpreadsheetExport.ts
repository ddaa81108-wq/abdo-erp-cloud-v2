import type { ERPState } from '../types';
import { objectRows } from '../utils/spreadsheet';

export function createErpWorkbookSheets(state: ERPState) {
  const customers = state.customers.map((customer) => {
    const activeCycle = state.cycles.find(
      (cycle) => cycle.customerId === customer.id && cycle.status === 'active',
    );
    return {
      'معرف الزبون': customer.id,
      'اسم الزبون بالكامل': customer.name,
      'الهاتف': customer.phone || 'غير مسجل',
      'تاريخ الانضمام والتسجيل': customer.createdAt
        ? new Date(customer.createdAt).toLocaleDateString('ar-LY')
        : '---',
      'الحالة الحالية': customer.isDeleted ? 'مؤرشف بالمهملات' : 'نشط جاري',
      'الدين المتبقي الحالي (د.ل)': activeCycle?.currentBalance || 0,
    };
  });
  const companies = state.companies.map((company) => ({
    'معرف الشركة': company.id,
    'اسم الجهة الموردة': company.name,
    'هاتف التواصل': company.contact || 'غير مسجل',
    'القيمة السابقة (د.ل)': company.previousBalance || 0,
    'فواتير جديدة اليوم (د.ل)': company.newDebt || 0,
    'المدفوع والمسدد اليوم (د.ل)': company.paymentToday || 0,
    'صافي الدين المتبقي (د.ل)': company.balance || 0,
    'حالة الأرشيف': company.isDeleted ? 'مؤرشف بالمهملات' : 'نشط بالدفتر',
  }));
  const purchases = state.purchases.map((purchase) => ({
    'رقم الفاتورة المعتمة': purchase.referenceNo,
    'تاريخ الاعتماد المالي': purchase.date
      ? new Date(purchase.date).toLocaleDateString('ar-LY')
      : '---',
    'اسم الصنف وتفاصيله': purchase.itemName,
    'الكمية الواردة': purchase.quantity,
    'سعر المفرد المحاسبي': purchase.unitPrice,
    'الإجمالي بالعملة الأصلية': purchase.totalPrice,
    'المعدل للعملة المحلية (د.ل)': purchase.conversionRate || 1,
    'الإجمالي المعادل بالليبي (د.ل)': purchase.totalPrice * (purchase.conversionRate || 1),
    'حالة الخزينة': purchase.postedToTreasury ? '✓ تم ترحيلها والخصم' : 'سداد خارجي فوري',
  }));
  const deposits = state.trustDeposits.map((deposit) => ({
    'رقم الأمانة': deposit.referenceNo,
    'اسم العميل المودع': deposit.customerName,
    'القيمة بالدينار الليبي د.ل': deposit.amountLyd,
    'القيمة بالجنيه المصري': deposit.amountEgp,
    'تاريخ الإيداع': deposit.date
      ? new Date(deposit.date).toLocaleDateString('ar-LY')
      : '---',
    'الحالة المحاسبية الحالية': deposit.status === 'held'
      ? 'محتجزة بالصندوق 🛡️'
      : deposit.status === 'refunded'
        ? 'مسترجعة للعميل ✕'
        : 'مسواة ومقاصة لدفتر ديونه ✓',
    'البيان والشرح': deposit.note,
  }));

  return [
    { name: 'ديون العملاء والزبائن', rows: objectRows(customers) },
    { name: 'حسابات الشركات والموردين', rows: objectRows(companies) },
    { name: 'مشتريات وفواتير اليوم', rows: objectRows(purchases) },
    { name: 'الأمانات وودائع الزباين', rows: objectRows(deposits) },
  ];
}
