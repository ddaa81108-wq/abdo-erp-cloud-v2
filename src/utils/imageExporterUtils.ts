import html2canvas from "html2canvas";

export const generateUnifiedSmartCard = async (
  name: string,
  amount: number,
  type: "debt" | "trust" | "clearance" | "zero" | "exchange_rate" | "transfer" | "trust_dual",
  rateOrValue?: string,
  targetCurrency: string = "د.ل",
  amountSecondary?: number,
  currencySecondary?: string
): Promise<boolean> => {
  return new Promise<boolean>(async (resolve) => {
    try {
      const container = document.createElement("div");
      container.style.width = "1000px";
      container.style.height = "800px";
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      
      let headerText = "❖ إشعار مديونية ❖";
      let statusLabel = "إجمالي الديون المستحقة عليك:";
      let amountFormatted = Math.abs(amount).toLocaleString('en-US');
      let displayAmountHtml = `
        <div style="font-size: 120pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; display: flex; align-items: center; justify-content: center; gap: 20px; color: #110c00;" dir="ltr">
            <span>${amountFormatted}</span> <span style="font-size: 35pt; font-weight: bold;">${targetCurrency}</span>
        </div>
      `;

      if (type === "debt") {
        headerText = "❖ إشعار مديونية ❖";
        statusLabel = "إجمالي الديون المستحقة عليك:";
        displayAmountHtml = `
          <div style="font-size: 120pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; display: flex; align-items: center; justify-content: center; gap: 20px; color: #110c00;" dir="ltr">
              <span>${amountFormatted}</span> <span style="font-size: 35pt; font-weight: bold;">${targetCurrency}</span>
          </div>
        `;
      } else if (type === "trust") {
        headerText = "❖ إشعار أمانة ❖";
        statusLabel = "صافي لك عندنا أمانة:";
        displayAmountHtml = `
          <div style="font-size: 120pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; display: flex; align-items: center; justify-content: center; gap: 20px; color: #110c00;" dir="ltr">
              <span>${amountFormatted}</span> <span style="font-size: 35pt; font-weight: bold;">${targetCurrency}</span>
          </div>
        `;
      } else if (type === "trust_dual" && amountSecondary !== undefined && currencySecondary) {
        headerText = "❖ إشعار أمانة ❖";
        statusLabel = "إجمالي الأمانات لكم:";
        let amountSecFormatted = Math.abs(amountSecondary).toLocaleString('en-US');
        displayAmountHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
            <div style="font-size: 90pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; display: flex; align-items: center; justify-content: center; gap: 20px; color: #110c00;" dir="ltr">
                <span>${amountFormatted}</span> <span style="font-size: 30pt; font-weight: bold;">${targetCurrency}</span>
            </div>
            <div style="font-size: 90pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; display: flex; align-items: center; justify-content: center; gap: 20px; color: #110c00;" dir="ltr">
                <span>${amountSecFormatted}</span> <span style="font-size: 30pt; font-weight: bold;">${currencySecondary}</span>
            </div>
          </div>
        `;
      } else if (type === "clearance" || type === "zero") {
        headerText = type === "clearance" ? "❖ إشعار مخالصة ❖" : "❖ تصفير حساب ❖";
        statusLabel = type === "clearance" ? "تمت المخالصة المالية بالكامل" : "تم تصفير رصيد الحساب بنجاح";
        displayAmountHtml = `
            <div style="width: 100%; display: flex; justify-content: center; align-items: center;">
                <div style="font-size: 140pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; color: #110c00;">0</div>
            </div>
        `;
      } else if (type === "exchange_rate") {
        headerText = "";
        statusLabel = "نعلمكم أن الأسعار متغيرة بتغيير سعر الدولار";
        displayAmountHtml = `
            <div style="font-size: 160pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; display: flex; align-items: center; justify-content: center; color: #110c00;" dir="ltr">
                <span>${rateOrValue || '0'}</span>
            </div>
        `;
      } else if (type === "transfer") {
        headerText = "❖ إشعار تحويل مالي ❖";
        statusLabel = "تفاصيل حوالة الصرف المستلمة والمحولة:";
        const rate = parseFloat(rateOrValue || "1");
        const converted = amount * rate;
        
        displayAmountHtml = `
            <div style="display: flex; gap: 30px; background: rgba(255, 255, 255, 0.4); border: 2px solid rgba(255, 255, 255, 0.6); padding: 15px 40px; border-radius: 20px; width: 85%; justify-content: space-around; margin: 20px 0;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <span style="font-size: 16pt; font-weight: bold; opacity: 0.8;">المبلغ المستلم</span>
                    <span style="font-size: 28pt; font-weight: 900;">${amountFormatted} د.ل</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <span style="font-size: 16pt; font-weight: bold; opacity: 0.8;">سعر الصرف</span>
                    <span style="font-size: 28pt; font-weight: 900;">${rate.toFixed(2)}</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <span style="font-size: 16pt; font-weight: bold; opacity: 0.8;">المبلغ المحول</span>
                    <span style="font-size: 28pt; font-weight: 900; color: #000000; background: #f1c40f; padding: 2px 10px; border-radius: 8px;">${converted.toLocaleString('en-US', {maximumFractionDigits:2})} ${targetCurrency}</span>
                </div>
            </div>
        `;
      }

      const isExchange = type === "exchange_rate";

      container.innerHTML = `
        <div style="width: 1000px; height: 800px; border-radius: 30px; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: ${isExchange ? 'center' : 'space-between'}; align-items: center; gap: ${isExchange ? '40px' : '0'}; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; background: linear-gradient(135deg, #fceabb 0%, #f8b500 40%, #d4af37 70%, #b38728 100%); border: 4px solid rgba(255, 255, 255, 0.8); color: #110c00; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;" dir="rtl">
            
            ${isExchange ? `
              <div style="width: 90%; text-align: center; border-top: 3px solid rgba(255, 255, 255, 0.4); border-bottom: 3px solid rgba(255, 255, 255, 0.4); padding: 15px 0; margin-top: 20px;">
                <div style="font-size: 38pt; font-weight: 900;">شركة الأهرام للاتصالات وتقنية المعلومات</div>
              </div>
            ` : `
              <div style="font-size: 26pt; font-weight: bold; margin-top: 5px; text-align: center;">${headerText}</div>
              <div style="font-size: 55pt; font-weight: 900; margin: 0; line-height: 1.1; text-align: center;">${name}</div>
            `}
            
            <div style="font-size: 24pt; font-weight: bold; text-align: center;">${statusLabel}</div>
            
            <div style="display: flex; justify-content: center; align-items: center; margin-top: 5px; margin-bottom: 5px; width: 100%;">
                ${displayAmountHtml}
            </div>
            
            ${!isExchange ? `
              <div style="font-size: 20pt; font-weight: 900; opacity: 0.95; white-space: nowrap; text-align: center;">شركة الأهرام للاتصالات وتقنية المعلومات</div>
              <div style="height: 35px; width: 100%;"></div>
            ` : ''}
        </div>
      `;

      document.body.appendChild(container);
      
      await new Promise(r => setTimeout(r, 100)); // allow render

      const makeImagePromise = async () => {
        const canvas = await html2canvas(container, {
          scale: 3, // slightly reduced scale to prevent huge payloads but keeps high quality
          backgroundColor: null,
          useCORS: true,
          logging: false
        });

        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          }, 'image/png');
        });
      };

      const blob = await makeImagePromise();
      
      try {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
      } catch (clipboardErr) {
        console.warn("Clipboard write failed, falling back to download", clipboardErr);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const fallbackName = name ? name.replace(/\s+/g, '_') : 'card';
        a.download = `kashf_${fallbackName}_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      resolve(true);
    } catch (err) {
      console.error("Failed to copy/share image", err);
      resolve(false);
    }
  });
};

export type SmartCardStudioType =
  | "debt"
  | "trust"
  | "zero"
  | "companies"
  | "masraweya"
  | "purchases"
  | "alert"
  | "exchange_rate";

export interface SmartCardStudioParams {
  type: SmartCardStudioType;
  name?: string;
  amount?: number | string;
  price?: string;
  note?: string;
  currency?: string;
  theme?: string;
  acctype?: "company" | "merchant";
  prev?: number | string;
  recv?: number | string;
  total?: number | string;
  remain?: number | string;
  merchant?: string;
  p1?: number | string;
  p2?: number | string;
  p3?: number | string;
  p4?: number | string;
  p5?: number | string;
}

// يفتح منظومة الكروت الذكية (card-generator.html) متملّية ببيانات القسم
export const openSmartCardStudio = (params: SmartCardStudioParams): void => {
  const url = new URL("/card-generator.html", window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  window.open(url.toString(), "_blank");
};

export const copySettledImage = async (name: string, titleText: string = "كارت مخالصة وتصفير حساب"): Promise<boolean> => {
  return generateUnifiedSmartCard(name, 0, "clearance");
};

export const copyCustomCardImage = async (value: string): Promise<boolean> => {
  return generateUnifiedSmartCard("", 0, "exchange_rate", value);
};

