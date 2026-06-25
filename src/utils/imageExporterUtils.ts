import html2canvas from "html2canvas";

export const copySettledImage = async (name: string, titleText: string = "كارت مخالصة وتصفير حساب") => {
  try {
    const makeImagePromise = async (): Promise<Blob> => {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "0px";
      container.style.top = "0px";
      container.style.zIndex = "-9999";
      container.style.opacity = "1";
      container.style.width = "540px";
      container.style.padding = "40px";
      container.style.backgroundColor = "#022c22"; // Darker Emerald Background
      container.style.direction = "rtl";
      container.style.fontFamily = "'Tajawal', 'Inter', system-ui, sans-serif";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.border = "none";
      
      const neonColor = '#10b981'; // Emerald 500
      const neonGlow = 'rgba(16, 185, 129, 0.6)';
      const softGlow = 'rgba(16, 185, 129, 0.2)';
      const neumorphicBg = 'linear-gradient(145deg, #022c22, #011e17)';

      container.innerHTML = `
        <div dir="rtl" style="position: relative; overflow: hidden; background: ${neumorphicBg}; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 48px; width: 100%; box-shadow: 20px 20px 60px #00120d, -20px -20px 60px #022c22;">
          
          <!-- Large Central 3D Badge -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); opacity: 0.1; pointer-events: none; display: flex; align-items: center; justify-content: center; z-index: 0;">
            <div style="border: 8px solid #fff; border-radius: 50%; padding: 40px; box-shadow: inset 0 0 40px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.2);">
              <span style="font-size: 80px; font-weight: 900; color: #fff; text-shadow: 0 10px 20px rgba(0,0,0,0.5); letter-spacing: -2px;">تم الخلاص</span>
            </div>
          </div>

          <div style="position: relative; z-index: 10;">
            <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid rgba(255,255,255,0.05); padding-bottom: 24px;">
              <div style="font-size: 16px; font-weight: 800; color: #34d399; margin-bottom: 8px; letter-spacing: 0;">${titleText}</div>
              <h2 style="font-size: 42px; font-weight: 900; color: #ffffff; margin: 0; white-space: pre-wrap; word-break: break-word; text-shadow: 0 4px 15px rgba(0,0,0,0.8); letter-spacing: 0;">${name}</h2>
            </div>
            
            <div style="text-align: center; margin-bottom: 28px;">
              <span style="font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.6; letter-spacing: 0;">
                نشهدكم بأنه قد تم تسوية الحساب بالكامل وليس لدينا أي مستحقات طرفكم
              </span>
            </div>
            
            <div style="background: rgba(2, 44, 34, 0.6); border: 2px solid ${neonColor}; border-radius: 20px; padding: 36px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; box-shadow: inset 0 0 30px ${softGlow}, 0 0 40px ${neonGlow}; backdrop-filter: blur(10px); width: 100%; position: relative;">
              <div style="position: absolute; top: -18px; background: ${neonColor}; color: #022c22; padding: 4px 16px; border-radius: 12px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 10px ${neonGlow}; letter-spacing: 0;">الرصيد الحالي</div>
              <span style="font-size: 80px; font-weight: 900; color: #facc15; font-family: monospace; text-shadow: 0 10px 25px rgba(0,0,0,0.8), 0 0 30px rgba(250, 204, 21, 0.6); line-height: 1;" dir="ltr">0</span>
            </div>

            <div style="margin-top: 48px; text-align: center; color: #6ee7b7; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); letter-spacing: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(52,211,153,0.5));"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              تم الإصدار من المنظومة
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(container);
      
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#022c22',
        useCORS: true,
      });
      
      document.body.removeChild(container);
      
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to generate image blob"));
        }, 'image/png');
      });
    };

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': makeImagePromise() as any
      })
    ]);
    
    return true;
  } catch (err) {
    console.error("Failed to copy settled image", err);
    alert("حدث خطأ أثناء نسخ كارت المخالصة.");
    return false;
  }
};

export const copyCustomCardImage = async (value: string) => {
  try {
    const makeImagePromise = async (): Promise<Blob> => {
      const container = document.createElement("div");
      container.className = "custom-card-container";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0px";
      container.style.zIndex = "-9999";
      container.style.opacity = "1";
      
      container.style.width = "1000px";
      container.style.minHeight = "600px";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.justifyContent = "center";
      container.style.alignItems = "center";
      container.style.background = "linear-gradient(135deg, #b38728 0%, #fbf5b7 25%, #daac3a 50%, #fcf6ba 75%, #aa771c 100%)";
      container.style.padding = "60px";
      container.style.direction = "rtl";
      container.style.fontFamily = "'Tajawal', 'Inter', system-ui, sans-serif";
      
      const darkText = '#161001';

      container.innerHTML = `
        <div style="text-align: center; width: 100%; margin-bottom: 40px;">
          <h2 style="font-size: 38pt; font-weight: 900; color: ${darkText}; margin: 0; white-space: pre-wrap; word-break: break-word; letter-spacing: 0px; line-height: 1.4; text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4);">شركة الأهرام للاتصالات وتقنية المعلومات</h2>
        </div>
        
        <div style="width: 50%; height: 2px; background: rgba(22, 16, 1, 0.2); margin: 0 auto 40px auto;"></div>
        
        <div style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.5); border-radius: 24px; padding: 40px 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.05); backdrop-filter: blur(8px); width: 80%; position: relative; margin: 0 auto;">
          <div style="font-size: 28px; font-weight: 900; color: ${darkText}; letter-spacing: 0px; text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4);">إشعار تسعير اليوم المعتمد</div>
          <span style="font-size: 65pt; font-weight: 900; color: ${darkText}; font-family: monospace; line-height: 1; letter-spacing: 0px; text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4);" dir="ltr">${value}</span>
        </div>

        <div style="margin-top: 40px; text-align: center; color: rgba(22, 16, 1, 0.7); font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; letter-spacing: 0px;">
          ❖ تم التوليد بنظام الإدارة الشامل ❖
        </div>
      `;
      
      document.body.appendChild(container);
      
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(container, {
        scale: 5,
        backgroundColor: null,
        useCORS: true,
      });
      
      document.body.removeChild(container);
      
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to generate image blob"));
        }, 'image/png');
      });
    };

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': makeImagePromise() as any
      })
    ]);
    
    return true;
  } catch (err) {
    console.error("Failed to copy custom image", err);
    alert("حدث خطأ أثناء نسخ الكارت المخصص.");
    return false;
  }
};
