// util
const debounce = (fn, ms = 0) => {
  let timeout = null;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, ms);
  };
};

const observe = (callback) => {
  const observer = new MutationObserver(function (mutations) {
    callback();
  });

  const config = {
    childList: true,
    subtree: true,
  };

  observer.observe(document.documentElement, config);

  return observer;
};

const getRepoId = () => {
  const pathNameParts = window.location.pathname.split("/");
  pathNameParts[4] =
    shaMapping.branches[getRepoHead()] ||
    shaMapping.tags[getRepoHead()] ||
    getRepoHead();
  return pathNameParts.join("/");
};

const getRepoName = () => {
  return window.location.pathname.split("/").slice(1, 3).join("/");
};

const getRepoHead = () => {
  return window.location.pathname.split("/")[4];
};

const getTrs = (lineNumbers) => {
  return lineNumbers
    .map((lineNumber) => `#L${lineNumber}`)
    .map((tdId) => document.querySelector(tdId))
    .filter((td) => td !== null)
    .map((td) => td.parentElement);
};

let oldLineNumbers = [];
const markRead = () => {
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
  const selectedLineNumbers = getCurrentSelectedLineNumbers();
  const key = getRepoId();

  chrome.storage.sync.get([key], (result) => {
    const oldLineNumbers = JSON.parse(result[key] || null) || [];
    const oldLineNumberSet = new Set(oldLineNumbers);
    const selectedLineNumberSet = new Set(selectedLineNumbers);
    const newLineNumbers = selectedLineNumbers.every((lineNumber) =>
      oldLineNumberSet.has(lineNumber)
    )
      ? oldLineNumbers.filter(
          (lineNumber) => selectedLineNumberSet.has(lineNumber) === false
        )
      : [...new Set(oldLineNumbers.concat(selectedLineNumbers))];

    const value = JSON.stringify(newLineNumbers);
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

let shaMapping = null;
let shaMappingPromise = null;
const fetchShaMapping = async () => {
  if (shaMapping === null) {
    shaMapping = {
      branches: {},
      tags: {},
      shas: {},
    };
    shaMappingPromise = await Promise.all([
      getShaMappingForBranchesOrTags(),
      getShaMappingForBranchesOrTags(false),
    ]);
  }
  await shaMappingPromise;
  markRead();
  return shaMapping;
};

const getShaMappingForBranchesOrTags = async (isBranch = true) => {
  return new Promise((resolve) => {
    var xhr = new XMLHttpRequest();
    const branchesOrTags = isBranch ? "branches" : "tags";
    xhr.open(
      "GET",
      `https://api.github.com/repos/${getRepoName()}/${branchesOrTags}`,
      true
    );

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.response);
        tags = response.map((item) => item.name);
        sha = response.map((item) => item.commit.sha);
        response.forEach((item) => {
          shaMapping[branchesOrTags][item.name] = item.commit.sha;
          shaMapping.shas[item.commit.sha] =
            shaMapping.shas[item.commit.sha] || [];
          shaMapping.shas[item.commit.sha].push(item.name);
        });
      } catch (error) {
        // do nothing
      } finally {
        resolve();
      }
    };

    xhr.send(null);
  });
};

const isSpecificCommit = async () => {
  const shaMapping = await fetchShaMapping();
  return !(getRepoHead() in shaMapping.branches);
};

const blobRe = /\/.*?\/.*?\/blob\/.*/;
let oldPathname = null;
let oldRepo = null;
const main = () => {
  if (!chrome.storage) return;
  if (blobRe.test(window.location.pathname) === false) return;

  // reset
  if (oldPathname !== window.location.pathname) {
    oldPathname = window.location.pathname;
    chrome.storage.onChanged.removeListener(markRead);
    chrome.storage.onChanged.addListener(markRead);
  }
  if (oldRepo !== getRepoName()) {
    oldRepo = getRepoName();
    shaMapping = null;
    shaMappingPromise = null;
  }

  markRead();
  addTdListeners();
};
const debouncedMain = debounce(main);

window.addEventListener("load", debouncedMain);
observe(debouncedMain);
