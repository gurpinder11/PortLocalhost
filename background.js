let currentTabId;

const fetchUsedPorts = () => {
  return new Promise((resolve) => {
    chrome.storage.sync.get("usedPorts", function (data) {
      resolve(data?.usedPorts || []);
    });
  });
};

const addUsedPorts = async (port) => {
  const usedPorts = await fetchUsedPorts();
  const uniqueUsedPorts = new Set([port, ...usedPorts]);
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      { usedPorts: Array.from(uniqueUsedPorts) },
      resolve
    );
  });
};

const getSuggestionPorts = async (text) => {
  const usedPorts = await fetchUsedPorts();
  return usedPorts
    .filter((usedPort) => usedPort.toString().includes(text))
    .slice(0, 3);
};

// Hanlding selection of a port
chrome.omnibox.onInputEntered.addListener(async (text) => {
  let port = parseInt(text);

  // https://www.sciencedirect.com/topics/computer-science/registered-port#:~:text=Registered%20ports%20are%20in%20the,range%20from%201024%20to%2049151.
  // Registered ports are in the range 1024 to 49151 and Dynamic ports are in the range 49152 to 65535
  if (isNaN(port) || port > 65535) {
    chrome.notifications.create(
      {
        type: "basic",
        iconUrl: "./icons/port_128.png",
        title: "Invalid Port !!!",
        message: `'${text}' is not a valid port`,
      },
      function (id) {
        console.log("Last error:", chrome.runtime.lastError);
      }
    );
  } else {
    const suggestionPorts = await getSuggestionPorts(text);

    if (suggestionPorts.length) {
      port = suggestionPorts[0];
    } else {
      await addUsedPorts(port);
    }

    chrome.tabs.update(currentTabId, { url: `https://localhost:${port}` });
  }
});

// Showing suggestions
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const port = parseInt(text);
  if (isNaN(port)) return;

  // Add suggestions to an array
  var suggestions = (await getSuggestionPorts(text)).map((usedPort) => ({
    content: `${usedPort}`,
    description: `<dim>localhost:</dim><match>${usedPort}</match>`,
    deletable: true,
  }));

  // Return suggestions
  if (suggestions.length) {
    // Set first suggestion as the default suggestion
    chrome.omnibox.setDefaultSuggestion({
      description: suggestions[0].description,
    });

    // Remove the first suggestion from the array since we just suggested it
    suggestions.shift();

    if (suggestions.length) {
      suggest(suggestions);
    }
  }
});

// Removing port from the storage
chrome.omnibox.onDeleteSuggestion.addListener(async (text) => {
  const usedPorts = await fetchUsedPorts();
  chrome.storage.sync.set({
    usedPorts: usedPorts.filter(
      (usedPort) => !text.toString().endsWith(usedPort)
    ),
  });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  currentTabId = activeInfo?.tabId;
});

chrome.action.onClicked.addListener((tab) => {
  chrome.windows.getCurrent({}, (currentWindow) => {
    chrome.tabs.query({ windowId: currentWindow.id, active: true }, (tabs) => {
      const tab = tabs[0];
      const groupId = tab.groupId;
      chrome.tabs.create({ index: tab.index + 1 }, (newTab) => {
        if (groupId >= 0) {
          chrome.tabs.group({ groupId, tabIds: newTab.id });
        }
      });
    });
  });
});
