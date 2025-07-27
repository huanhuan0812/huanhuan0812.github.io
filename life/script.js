document.addEventListener('DOMContentLoaded', function() {
    // 获取文件列表容器和内容容器
    const fileListContainer = document.getElementById('file-list');
    const markdownContent = document.getElementById('markdown-content');
    
    // 存储当前选中的文件
    let currentFile = null;
    
    // 获取当前目录下的 Markdown 文件
    fetchMarkdownFiles();
    
    // 获取 Markdown 文件列表
    async function fetchMarkdownFiles() {
        try {
            // 获取当前目录下的所有文件
            const response = await fetch(window.location.href, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('无法获取文件列表');
            }
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // 提取所有链接（文件）
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href.endsWith('.md') && !href.includes('index.html'));
            
            // 显示文件列表
            displayFileList(links);
            
            // 如果有文件，默认加载第一个
            if (links.length > 0) {
                loadMarkdownFile(links[0]);
            }
            
        } catch (error) {
            console.error('获取文件列表失败:', error);
            fileListContainer.innerHTML = '<p>无法加载文件列表</p>';
        }
    }
    
    // 显示文件列表
    function displayFileList(files) {
        if (files.length === 0) {
            fileListContainer.innerHTML = '<p>没有找到 Markdown 文件</p>';
            return;
        }
        
        fileListContainer.innerHTML = '';
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.textContent = file;
            
            fileItem.addEventListener('click', () => {
                // 移除之前选中的样式
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // 添加当前选中的样式
                fileItem.classList.add('active');
                
                // 加载选中的文件
                loadMarkdownFile(file);
            });
            
            fileListContainer.appendChild(fileItem);
        });
    }
    
    // 加载并渲染 Markdown 文件
    async function loadMarkdownFile(filename) {
        currentFile = filename;
        
        try {
            const response = await fetch(filename);
            
            if (!response.ok) {
                throw new Error('文件加载失败');
            }
            
            const markdownText = await response.text();
            
            // 使用 marked.js 渲染 Markdown
            markdownContent.innerHTML = marked.parse(markdownText);
            
            // 更新 URL 但不刷新页面
            history.pushState(null, '', `?file=${encodeURIComponent(filename)}`);
            
        } catch (error) {
            console.error('加载 Markdown 文件失败:', error);
            markdownContent.innerHTML = `<p>无法加载文件: ${filename}</p>`;
        }
    }
    
    // 处理浏览器前进/后退
    window.addEventListener('popstate', function() {
        const params = new URLSearchParams(window.location.search);
        const fileParam = params.get('file');
        
        if (fileParam && fileParam !== currentFile) {
            loadMarkdownFile(fileParam);
            
            // 更新选中的文件样式
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.toggle('active', item.textContent === fileParam);
            });
        }
    });
    
    // 检查 URL 中的文件参数
    const params = new URLSearchParams(window.location.search);
    const fileParam = params.get('file');
    
    if (fileParam) {
        loadMarkdownFile(fileParam);
    }
});