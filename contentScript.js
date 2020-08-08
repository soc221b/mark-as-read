// util
const debounce = (fn, ms = 0) => {
  let timeout = null;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, ms);
  };
};

const observeUrlUpdate = (callback) => {
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      callback();
    });
  });

  const config = {
    childList: true,
    subtree: true,
  };

  observer.observe(document.documentElement, config);

  return observer;
};

const getRepoId = () => {
  return window.location.pathname;
};

const getTrs = (lineNumbers) => {
  return lineNumbers
    .map((lineNumber) => `#L${lineNumber}`)
    .map((tdId) => document.querySelector(tdId))
    .filter((td) => td !== null)
    .map((td) => td.parentElement);
};

let oldLineNumbers = [];
const markReadByLineNumbers = () => {
  const key = getRepoId();
  chrome.storage.sync.get([key], (result) => {
    const lineNumbers = JSON.parse(result[key] || null) || [];

    const trs = getTrs(lineNumbers);

    getTrs(oldLineNumbers).forEach((tr) =>
      tr.classList.remove("mark-as-read--read")
    );
    trs.forEach((tr) => tr.classList.add("mark-as-read--read"));

    oldLineNumbers = lineNumbers;
  });
};

const getCurrentSelectedLineNumbers = () => {
  const range = window.location.hash.slice(1).split("-");
  const startLineNumber = parseInt(range[0].slice(1), 10);
  const endLineNumber = parseInt((range[1] || range[0]).slice(1), 10);

  return Array(endLineNumber - startLineNumber + 1)
    .fill(null)
    .map((_, index) => index + startLineNumber);
};

const updateLineNumbers = () => {
  const newLineNumbers = getCurrentSelectedLineNumbers();
  const key = getRepoId();

  chrome.storage.sync.get([key], (result) => {
    const oldLineNumbers = JSON.parse(result[key] || null) || [];
    const oldLineNumberSet = new Set(oldLineNumbers);
    const newLineNumberSet = new Set(newLineNumbers);
    const finalLineNumbers = newLineNumbers.every((lineNumber) =>
      oldLineNumberSet.has(lineNumber)
    )
      ? oldLineNumbers.filter(
          (lineNumber) => newLineNumberSet.has(lineNumber) === false
        )
      : [...new Set(oldLineNumbers.concat(newLineNumbers))];

    const value = JSON.stringify(finalLineNumbers);
    chrome.storage.sync.set({ [key]: value });
  });
};

const debouncedUpdateLineNumbers = debounce(updateLineNumbers);

const tdIeRe = /^L\d+$/;
const addTdListeners = () => {
  document.querySelectorAll("td").forEach((td) => {
    td.addEventListener("click", (event) => {
      if (tdIeRe.test(event.srcElement.id)) {
        debouncedUpdateLineNumbers();
      }
    });
  });
};

let warned = false;
const main = () => {
  if (!chrome.storage) return;

  if (
    /^\/.*?\/.*?\/blob\/[0-9a-f]{40}\/.*$/.test(window.location.pathname) ===
      false &&
    warned === false
  ) {
    warned = true;
    console.log(
      "[chrome extensions: mark-as-read] It is recommended to navigate to a specific commit instead of this branch since content will probably be changed in future."
    );
  }

  chrome.storage.onChanged.removeListener(markReadByLineNumbers);
  chrome.storage.onChanged.addListener(markReadByLineNumbers);
  markReadByLineNumbers();
  addTdListeners();
};
const debouncedMain = debounce(main);

window.addEventListener("load", debouncedMain);
observeUrlUpdate(debouncedMain);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(
    sender.tab
      ? "from a content script:" + sender.tab.url
      : "from the extension"
  );
  if (request.greeting == "hello") sendResponse({ farewell: "goodbye" });
});
