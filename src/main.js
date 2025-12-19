// --- Gemini API Configuration ---
const apiKey = import.meta.env.VITE_GEMINI_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- Elements ---
const micBtn = document.getElementById("mic-btn");
const statusText = document.getElementById("status-text");
const textArea = document.getElementById("final-transcript");
const copyBtn = document.getElementById("copy-btn");
const clearBtn = document.getElementById("clear-btn");
const toast = document.getElementById("toast");
const aiOutput = document.getElementById("ai-output");
const loadingOverlay = document.getElementById("loading-overlay");
const copyAiBtn = document.getElementById("copy-ai-btn");
const languageSelect = document.getElementById("language-select");
const micLanguageSelect = document.getElementById("mic-language");

// --- Variables ---
let recognition;
let isRecording = false;

// --- Speech Recognition Setup ---
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  // Set initial language
  recognition.lang = micLanguageSelect.value;

  // Update language when dropdown changes
  micLanguageSelect.addEventListener("change", () => {
    recognition.lang = micLanguageSelect.value;
    // If recording, restart to apply change
    if (isRecording) {
      recognition.stop();
      setTimeout(() => recognition.start(), 100);
    }
  });

  recognition.onstart = () => {
    isRecording = true;
    updateUI(true);
  };
  recognition.onend = () => {
    isRecording = false;
    updateUI(false);
  };
  recognition.onerror = (event) => {
    console.error("Speech error", event.error);
    statusText.textContent = "Error: " + event.error;
    isRecording = false;
    updateUI(false);
  };

  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        insertAtCursor(textArea, event.results[i][0].transcript + " ");
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    if (interimTranscript) {
      statusText.textContent =
        "Heard: " + interimTranscript.substring(0, 30) + "...";
      statusText.className = "text-green-600 font-medium h-6 text-sm italic";
    }
  };
} else {
  micBtn.disabled = true;
  statusText.textContent = "Browser not supported. Try Chrome!";
  statusText.className = "text-red-500 font-bold h-6 text-sm";
}

// --- AI Logic ---
async function runAI(mode) {
  const text = textArea.value.trim();
  if (!text) {
    showToast("Please speak or type some text first!");
    return;
  }

  // Set specific prompt based on mode
  let systemInstruction = "";
  let prompt = "";

  switch (mode) {
    case "polish":
      systemInstruction =
        "You are a helpful editor. Rewrite the user's text to be grammatically correct, concise, and professional. Remove filler words like 'um', 'uh', 'like'. Keep the original meaning intact.";
      prompt = `Polish this text: "${text}"`;
      break;
    case "summarize":
      systemInstruction =
        "You are a helpful assistant. Summarize the user's text into a concise paragraph. Capture the main points clearly.";
      prompt = `Summarize this: "${text}"`;
      break;
    case "tasks":
      systemInstruction =
        "You are a project manager assistant. Extract actionable tasks from the text and list them as bullet points. If no tasks are found, say 'No actionable tasks found.'";
      prompt = `Extract tasks from: "${text}"`;
      break;
    case "translate":
      const targetLang = languageSelect.value;
      systemInstruction = `You are a professional translator. Translate the following text into ${targetLang}. Maintain the tone of the original text. Output only the translated text.`;
      prompt = `Translate to ${targetLang}: "${text}"`;
      break;
  }

  showLoading(true);

  try {
    const response = await callGeminiAPI(prompt, systemInstruction);
    // Parse markdown to HTML
    aiOutput.innerHTML = marked.parse(response);
  } catch (error) {
    aiOutput.innerHTML = `<p class="text-red-500">Error: ${error.message}. Please try again.</p>`;
  } finally {
    showLoading(false);
  }
}

async function callGeminiAPI(userPrompt, systemInstruction) {
  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
  };

  // Exponential backoff logic
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response generated."
      );
    } catch (error) {
      if (i === 4) throw error; // Rethrow after last attempt
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }
}

// --- Helper Functions ---
function updateUI(recording) {
  if (recording) {
    micBtn.classList.remove("bg-gray-100", "text-gray-400");
    micBtn.classList.add("bg-red-500", "text-white", "mic-pulse");
    statusText.textContent = "Listening...";
    statusText.className = "text-green-600 font-bold h-6 text-sm";
  } else {
    micBtn.classList.add("bg-gray-100", "text-gray-400");
    micBtn.classList.remove("bg-red-500", "text-white", "mic-pulse");
    statusText.textContent = "Click the mic to speak...";
    statusText.className = "text-gray-500 font-medium h-6 text-sm";
  }
}

function showLoading(isLoading) {
  if (isLoading) loadingOverlay.classList.remove("hidden");
  else loadingOverlay.classList.add("hidden");
}

function insertAtCursor(myField, myValue) {
  if (document.selection) {
    myField.focus();
    sel = document.selection.createRange();
    sel.text = myValue;
  } else if (myField.selectionStart || myField.selectionStart == "0") {
    var startPos = myField.selectionStart;
    var endPos = myField.selectionEnd;
    myField.value =
      myField.value.substring(0, startPos) +
      myValue +
      myField.value.substring(endPos, myField.value.length);
    myField.selectionStart = startPos + myValue.length;
    myField.selectionEnd = startPos + myValue.length;
  } else {
    myField.value += myValue;
  }
  myField.scrollTop = myField.scrollHeight;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("opacity-0");
  setTimeout(() => toast.classList.add("opacity-0"), 2000);
}

// --- Event Listeners ---
micBtn.addEventListener("click", () => {
  if (!recognition) return;
  isRecording ? recognition.stop() : recognition.start();
});

copyBtn.addEventListener("click", () => {
  if (!textArea.value) return;
  textArea.select();
  textArea.setSelectionRange(0, 99999);
  try {
    document.execCommand("copy");
    showToast("Transcript copied!");
  } catch (err) {
    console.error(err);
  }
});

clearBtn.addEventListener("click", () => {
  textArea.value = "";
  statusText.textContent = "Cleared!";
  setTimeout(() => updateUI(isRecording), 1000);
});

copyAiBtn.addEventListener("click", () => {
  const aiText = aiOutput.innerText; // Get text content only, not HTML
  if (!aiText || aiText.includes("Select an AI tool")) return;

  // Create temporary textarea for copying
  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = aiText;
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  try {
    document.execCommand("copy");
    showToast("AI result copied!");
  } catch (err) {
    console.error(err);
  }
  document.body.removeChild(tempTextArea);
});

window.runAI = runAI;
