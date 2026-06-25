import html2canvas from "html2canvas";

export const copySettledImage = async (name: string, titleText: string = "كارت مخالصة وتصفير حساب"): Promise<boolean> => {
  return new Promise<boolean>(async (resolve) => {
    try {
      const container = document.createElement("div");
      container.style.width = "1150px";
      container.style.height = "800px";
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      
      container.innerHTML = `
        <div style="width: 1150px; height: 800px; border-radius: 30px; padding: 40px 50px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; background: linear-gradient(135deg, #fceabb 0%, #f8b500 40%, #d4af37 70%, #b38728 100%); border: 4px solid #ffffff; color: #161001; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;" dir="rtl">
            <div style="font-size: 34pt; font-weight: bold; margin-top: 15px; white-space: nowrap;">❖ مخالصة وتصفير حساب ❖</div>
            
            <div style="font-size: 65pt; font-weight: 900; margin: 0; line-height: 1.2; white-space: nowrap; color: #110c00;">${name}</div>
            
            <div style="font-size: 26pt; font-weight: bold; color: #2b1d00; white-space: nowrap;">الآن رصيدكم:</div>
            
            <div style="width: 750px; height: 230px; display: flex; justify-content: center; align-items: center; margin-bottom: 20px; background: radial-gradient(ellipse at center, rgba(255,255,255,0.5) 10%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 80%); border: none; border-radius: 50%;">
                <div style="font-size: 160pt; font-weight: 900; font-family: 'Arial Black', Impact, Arial, sans-serif; margin: 0; line-height: 1; color: #110c00;">0</div>
            </div>
            
            <div style="font-size: 24pt; font-weight: 900; opacity: 0.95; line-height: 1; white-space: nowrap;">شركة الأهرام للاتصالات وتقنية المعلومات</div>
            <div style="height: 40px; width: 100%;"></div>
        </div>
      `;

      document.body.appendChild(container);
      
      await new Promise(r => setTimeout(r, 100)); // allow render

      const canvas = await html2canvas(container, {
        scale: 4,
        useCORS: true,
        backgroundColor: null
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          document.body.removeChild(container);
          return resolve(false);
        }
        
        const fileName = "مخالصة_" + name + "_" + new Date().getTime() + ".png";
        const file = new File([blob], fileName, { type: "image/png" });

        const fallbackDownload = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        if (navigator.share) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'مخالصة وتصفير حساب',
                });
            } catch (err) {
                fallbackDownload();
            }
        } else {
            fallbackDownload();
        }

        document.body.removeChild(container);
        resolve(true);
      }, 'image/png');

    } catch (err) {
      console.error("Failed to copy/share image", err);
      resolve(false);
    }
  });
};

export const copyCustomCardImage = async (value: string): Promise<boolean> => {
  return new Promise<boolean>(async (resolve) => {
    try {
      const container = document.createElement("div");
      container.className = "custom-card-container";
      container.style.width = "1000px";
      container.style.minHeight = "600px";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.justifyContent = "center";
      container.style.alignItems = "center";
      container.style.background = "linear-gradient(135deg, #b38728 0%, #fbf5b7 25%, #daac3a 50%, #fcf6ba 75%, #aa771c 100%)";
      container.style.padding = "30px 60px 90px 60px";
      container.style.direction = "rtl";
      container.style.fontFamily = "'Tajawal', 'Inter', system-ui, sans-serif";
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      
      const darkText = '#161001';

      container.innerHTML = `
        <div style="text-align: center; width: 100%; margin-bottom: 40px;">
          <h2 style="font-size: 38pt; font-weight: 900; color: ${darkText}; margin: 0; line-height: 1.4; text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4); display: inline-block; padding: 0 10px; border-radius: 8px;">
            شركة الأهرام للاتصالات وتقنية المعلومات
          </h2>
        </div>
        
        <div style="width: 50%; height: 2px; background: rgba(22, 16, 1, 0.2); margin: 0 auto 40px auto;"></div>
        
        <div style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.5); border-radius: 24px; padding: 40px 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.05); backdrop-filter: blur(8px); width: 80%; position: relative; margin: 0 auto;">
          <div style="font-size: 28px; font-weight: 900; color: ${darkText}; text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4);">إشعار تسعير اليوم المعتمد</div>
          <span style="font-size: 65pt; font-weight: 900; color: ${darkText}; font-family: monospace; line-height: 1; text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4);" dir="ltr">${value}</span>
        </div>

        <div style="margin-top: 40px; text-align: center; color: rgba(22, 16, 1, 0.7); font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
          ❖ تم التوليد بنظام الإدارة الشامل ❖
        </div>
      `;

      document.body.appendChild(container);
      
      await new Promise(r => setTimeout(r, 100)); // allow render

      const makeImagePromise = async () => {
        const canvas = await html2canvas(container, {
          scale: 5,
          backgroundColor: null,
          useCORS: true
        });

        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          }, 'image/png');
        });
      };

      const item = new ClipboardItem({ "image/png": makeImagePromise() });
      await navigator.clipboard.write([item]);
      
      document.body.removeChild(container);
      alert("تم نسخ الكارت بنجاح!");
      resolve(true);
    } catch (err) {
      console.error("Failed to copy image", err);
      alert("حدث خطأ أثناء النسخ");
      resolve(false);
    }
  });
};
