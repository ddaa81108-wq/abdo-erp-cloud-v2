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
      container.style.height = "800px";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.justifyContent = "center";
      container.style.alignItems = "center";
      // Golden gradient background
      container.style.background = "linear-gradient(145deg, #fde488 0%, #dfb542 50%, #b8861b 100%)";
      container.style.padding = "60px";
      container.style.direction = "rtl";
      container.style.fontFamily = "'Tajawal', 'Inter', system-ui, sans-serif";
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.borderRadius = "20px";
      
      const darkText = '#110c00';

      container.innerHTML = `
        <div style="width: 90%; height: 2px; background: rgba(255, 255, 255, 0.5); margin-bottom: 40px;"></div>
        
        <div style="text-align: center; width: 100%; margin-bottom: 40px;">
          <h2 style="font-size: 50pt; font-weight: 900; color: ${darkText}; margin: 0; line-height: 1.3;">
            شركة الأهرام للاتصالات وتقنية<br/>المعلومات
          </h2>
        </div>
        
        <div style="width: 90%; height: 2px; background: rgba(255, 255, 255, 0.5); margin-bottom: 60px;"></div>
        
        <div style="font-size: 32pt; font-weight: bold; color: ${darkText}; margin-bottom: 40px; text-align: center;">
          نعلمكم أن الأسعار متغيرة بتغيير سعر الدولار
        </div>
        
        <div style="font-size: 160pt; font-weight: 900; color: ${darkText}; font-family: 'Arial Black', Impact, sans-serif; line-height: 1; text-align: center;" dir="ltr">
          ${value}
        </div>
      `;

      document.body.appendChild(container);
      
      await new Promise(r => setTimeout(r, 100)); // allow render

      const makeImagePromise = async () => {
        const canvas = await html2canvas(container, {
          scale: 4,
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
      resolve(true);
    } catch (err) {
      console.error("Failed to copy image", err);
      resolve(false);
    }
  });
};
