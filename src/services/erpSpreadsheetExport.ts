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
  const purchases = (state.purchases || []).map((purchase) => purchase.merchant ? ({
    'التاجر': purchase.merchant === 'baqy' ? 'البيان' : 'سمسم',
    'التسلسل': purchase.seq || 0,
    'تاريخ المعاملة': purchase.date,
    'نوع المعاملة': purchase.type || '',
    'القيمة المصرية': purchase.value || 0,
    'العملية': purchase.op === 'multiply' ? 'ضرب' : 'قسمة',
    'سعر الصرف': purchase.rate || 0,
    'الناتج الليبي': purchase.result || 0,
    'المسدد الليبي': purchase.paid || 0,
    'الباقي الليبي': purchase.remaining || 0,
    'مستهلك فودافون المصري': purchase.consumer || 0,
    'حالة السجل': purchase.isDeleted ? 'في سلة المهملات' : 'نشط/مؤرشف',
  }) : ({
    'رقم الفاتورة المعتمة': purchase.referenceNo || '',
    'تاريخ الاعتماد المالي': purchase.date
      ? new Date(purchase.date).toLocaleDateString('ar-LY')
      : '---',
    'اسم الصنف وتفاصيله': purchase.itemName || '',
    'الكمية الواردة': purchase.quantity || 0,
    'سعر المفرد المحاسبي': purchase.unitPrice || 0,
    'الإجمالي بالعملة الأصلية': purchase.totalPrice || 0,
    'المعدل للعملة المحلية (د.ل)': purchase.conversionRate || 1,
    'الإجمالي المعادل بالليبي (د.ل)': (purchase.totalPrice || 0) * (purchase.conversionRate || 1),
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
