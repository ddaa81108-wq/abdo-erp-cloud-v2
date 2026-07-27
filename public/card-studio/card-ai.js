(function () {
  let customBackgroundUrl = "";

  const cards = () => [
    document.getElementById("goldenCard"),
    document.getElementById("exchangeCard"),
  ].filter(Boolean);

  function applyBackgroundUrl(url, render = true) {
    customBackgroundUrl = url;
    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect) themeSelect.value = "bg-custom-image";
    const titleColor = document.getElementById("titleColorPicker");
    if (titleColor) titleColor.value = "#ffffff";
    cards().forEach((target) => {
      target.style.setProperty(
        "background-image",
        `linear-gradient(90deg, rgba(3, 10, 18, .46), rgba(3, 10, 18, .2), rgba(3, 10, 18, .46)), url("${url}")`,
        "important",
      );
    });
    if (render) window.updateCard?.();
  }

  function clearCustomBackgroundIfNeeded(theme) {
    if (theme === "bg-custom-image" && customBackgroundUrl) {
      applyBackgroundUrl(customBackgroundUrl, false);
      return;
    }
    cards().forEach((target) => target.style.removeProperty("background-image"));
  }

  function uploadBackground(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("اختر ملف صورة صالحاً.");
      input.value = "";
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      window.alert("حجم الخلفية يجب ألا يتجاوز 12 ميجابايت.");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => applyBackgroundUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function generateBackground() {
    const prompt = document.getElementById("aiBackgroundPrompt")?.value.trim();
    if (!prompt) {
      window.alert("اكتب وصف الخلفية المطلوبة أولاً.");
      return;
    }
    const endpoint = document
      .querySelector('meta[name="smart-card-ai-endpoint"]')
      ?.getAttribute("content");
    if (!endpoint) {
      window.alert(
        "واجهة التوليد جاهزة، لكن تشغيل التوليد المباشر يحتاج خدمة خلفية آمنة ومفتاحاً سرياً على الخادم. يمكنك حالياً رفع أي صورة مولدة من زر «إضافة خلفية من الجهاز».",
      );
      return;
    }

    const button = document.getElementById("generateAiBackgroundButton");
    if (button) button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error(`AI background request failed: ${response.status}`);
      const payload = await response.json();
      if (!payload.imageUrl) throw new Error("AI background response has no image URL");
      applyBackgroundUrl(payload.imageUrl);
    } catch (error) {
      console.error(error);
      window.alert("تعذر توليد الخلفية الآن. لم تتغير بيانات الكارت.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.CardStudioAI = {
    applyBackgroundUrl,
    clearCustomBackgroundIfNeeded,
    uploadBackground,
    generateBackground,
  };
})();
