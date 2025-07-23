// Test suite for sidebar resize functionality
describe('Sidebar Resize Functionality', () => {
  let sidebar;
  let resizeHandle;
  let mainContent;
  let header;
  let originalSidebarWidth;
  let originalMainContentMargin;

  // Setup DOM elements before each test
  beforeEach(() => {
    document.body.innerHTML = `
      <aside id="sidebar" class="resizable-sidebar fixed left-0 top-0 w-64 h-full bg-white dark:bg-gray-800 p-4 shadow-2xl border-r border-gray-200 dark:border-gray-700 z-10">
        <div id="resize-handle" class="resize-handle"></div>
      </aside>
      <main class="flex-1 ml-64 relative">
        <div class="fixed top-0 right-0 left-64 bg-gradient-to-br from-blue-50 via-gray-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 z-10">
          <header class="flex justify-between items-center p-6 pb-4">
            <h1>Header Content</h1>
          </header>
        </div>
        <div class="pt-44 p-6 h-screen overflow-y-auto">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
            <div>Content</div>
          </div>
        </div>
      </main>
    `;

    // Initialize variables
    sidebar = document.getElementById('sidebar');
    resizeHandle = document.getElementById('resize-handle');
    mainContent = document.querySelector('main');
    header = document.querySelector('.fixed.top-0');

    // Store original values
    originalSidebarWidth = 256; // w-64 = 16 * 16px = 256px
    originalMainContentMargin = 256; // ml-64 = 16 * 16px = 256px
  });

  // Mock the resize functionality from renderer.js
  function setupResizeListeners() {
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const minWidth = 200;
      const maxWidth = 500;
      const newWidth = e.clientX;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        sidebar.style.width = newWidth + 'px';
        // Update main content margin to prevent overlap
        mainContent.style.marginLeft = newWidth + 'px';
        // Update header left position
        header.style.left = newWidth + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    });
  }

  test('should resize sidebar and adjust main content and header', () => {
    // Setup resize listeners
    setupResizeListeners();

    // Simulate mousedown on resize handle
    const mousedownEvent = new MouseEvent('mousedown', {
      clientX: originalSidebarWidth,
      bubbles: true,
      cancelable: true
    });
    resizeHandle.dispatchEvent(mousedownEvent);

    // Simulate mousemove to resize
    const mousemoveEvent = new MouseEvent('mousemove', {
      clientX: 300,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(mousemoveEvent);

    // Simulate mouseup
    const mouseupEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(mouseupEvent);

    // Check if sidebar width was updated
    expect(parseInt(sidebar.style.width)).toBe(300);

    // Check if main content margin was updated
    expect(parseInt(mainContent.style.marginLeft)).toBe(300);

    // Check if header left position was updated
    expect(parseInt(header.style.left)).toBe(300);
  });

  test('should maintain minimum and maximum width constraints', () => {
    // Setup resize listeners
    setupResizeListeners();

    // Simulate mousedown on resize handle
    const mousedownEvent = new MouseEvent('mousedown', {
      clientX: originalSidebarWidth,
      bubbles: true,
      cancelable: true
    });
    resizeHandle.dispatchEvent(mousedownEvent);

    // Simulate mousemove to resize beyond maximum
    const mousemoveEventMax = new MouseEvent('mousemove', {
      clientX: 600,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(mousemoveEventMax);

    // Check if width is capped at maximum
    expect(parseInt(sidebar.style.width)).toBeLessThanOrEqual(500);

    // Reset
    sidebar.style.width = '';
    mainContent.style.marginLeft = '';
    header.style.left = '';

    // Simulate mousemove to resize below minimum
    const mousemoveEventMin = new MouseEvent('mousemove', {
      clientX: 100,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(mousemoveEventMin);

    // Check if width is capped at minimum
    expect(parseInt(sidebar.style.width)).toBeGreaterThanOrEqual(200);

    // Complete the drag operation
    const mouseupEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(mouseupEvent);
  });

  test('should save and restore sidebar width from localStorage', () => {
  // Setup resize listeners
  setupResizeListeners();

  // Clear localStorage
  localStorage.clear();

  // Simulate resize
  const mousedownEvent = new MouseEvent('mousedown', {
    clientX: originalSidebarWidth,
    bubbles: true,
    cancelable: true
  });
  resizeHandle.dispatchEvent(mousedownEvent);

  const mousemoveEvent = new MouseEvent('mousemove', {
    clientX: 350,
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(mousemoveEvent);

  const mouseupEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(mouseupEvent);

  // Check if width was saved to localStorage
  expect(localStorage.getItem('sidebarWidth')).toBe('350px');

  // Create new elements to simulate page reload
  document.body.innerHTML = `
    <aside id="sidebar" class="resizable-sidebar fixed left-0 top-0 w-64 h-full bg-white dark:bg-gray-800 p-4 shadow-2xl border-r border-gray-200 dark:border-gray-700 z-10">
      <div id="resize-handle" class="resize-handle"></div>
    </aside>
    <main class="flex-1 ml-64 relative">
      <div class="fixed top-0 right-0 left-64 bg-gradient-to-br from-blue-50 via-gray-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 z-10">
        <header class="flex justify-between items-center p-6 pb-4">
          <h1>Header Content</h1>
        </header>
      </div>
      <div class="pt-44 p-6 h-screen overflow-y-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
          <div>Content</div>
        </div>
      </div>
    </main>
  `;

  sidebar = document.getElementById('sidebar');
  resizeHandle = document.getElementById('resize-handle');
  mainContent = document.querySelector('main');
  header = document.querySelector('.fixed.top-0');

  // Simulate page load with saved width
  if (localStorage.getItem('sidebarWidth')) {
    document.body.style.setProperty('--sidebar-width', localStorage.getItem('sidebarWidth'));
  }

  // Check if saved width was applied via CSS variable
  expect(getComputedStyle(document.body).getPropertyValue('--sidebar-width').trim()).toBe('350px');
  expect(getComputedStyle(sidebar).width).toBe('350px');
  expect(getComputedStyle(mainContent).marginLeft).toBe('350px');
  expect(getComputedStyle(header).left).toBe('350px');
});
});