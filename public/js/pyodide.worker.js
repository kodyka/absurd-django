importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js");

async function loadPyodideAndPackages() {
  self.pyodide = await loadPyodide();

// Create a mount directory for the filesystem
let mountDir = "/data";
pyodide.FS.mkdir(mountDir);
pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, { root: "." }, mountDir);
// Synchronize the filesystem
await new Promise((resolve, reject) => {
pyodide.FS.syncfs(true, (err) => {
if (err) {
reject(err);
} else {
resolve();
}
});
});

  await self.pyodide.loadPackage(["micropip"]);

  await self.pyodide.runPythonAsync(`
    import micropip
    print("installing django")
    await micropip.install('tzdata')
    await micropip.install('django')
  `);
}

// Initialize Pyodide and load required packages
let pyodideReadyPromise = loadPyodideAndPackages().then(() => {
// Notify the main thread that Pyodide is ready
self.postMessage({ ready: true });
});
// Handle incoming messages from the main thread
self.onmessage = async (event) => {
// Wait for Pyodide to be ready
await pyodideReadyPromise;
// Extract data from the event
const { id, python, ...context } = event.data;
// Set context variables in the worker
for (const key of Object.keys(context)) {
self[key] = context[key];
}
try {
// Load any additional packages required by the Python code
await self.pyodide.loadPackagesFromImports(python);

// Execute the Python code and store the result
const result = pyodide.runPython(python);

// Synchronize the filesystem and send the result back to the main thread
self.pyodide.FS.syncfs(false, (err) => {
  self.postMessage({ result, id });
});
  } catch (error) {
    // Send any errors back to the main thread
    self.postMessage({ error: error.message, id });
  }
};
