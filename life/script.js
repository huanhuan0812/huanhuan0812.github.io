document.addEventListener('DOMContentLoaded', function() {
    const fileListContainer = document.getElementById('file-list');
    const markdownContent = document.getElementById('markdown-content');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    let currentFile = null;
    let allFiles = []; // 存储所有文件列表
    let fileMetadata = {}; // 存储文件的元数据
    
    // 缓存设置
    const CACHE_NAME = 'md-browser-cache';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时缓存
    
    // 初始化缓存
    async function initCache() {
        if (!('caches' in window)) return;
        
        try {
            const cache = await caches.open(CACHE_NAME);
            // 清理过期缓存
            const keys = await cache.keys();
            const now = Date.now();
            
            for (const request of keys) {
                const cachedResponse = await cache.match(request);
                const cachedDate = new Date(cachedResponse.headers.get('date'));
                
                if (now - cachedDate.getTime() > CACHE_EXPIRY) {
                    await cache.delete(request);
                }
            }
        } catch (error) {
            console.error('缓存初始化失败:', error);
        }
    }
    
    // 解析Frontmatter
    function parseFrontmatter(content) {
        const frontmatter = { title: null, tags: [] };
        
        // 匹配YAML格式的Frontmatter
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (match) {
            const yamlContent = match[1];
            try {
                // 简单解析YAML（实际项目中可以使用js-yaml等库）
                yamlContent.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('title:')) {
                        frontmatter.title = trimmed.substring(6).trim().replace(/^['"]|['"]$/g, '');
                    } else if (trimmed.startsWith('tags:')) {
                        const tagsStr = trimmed.substring(5).trim();
                        frontmatter.tags = tagsStr.split(',').map(tag => tag.trim().replace(/^['"\[\]]|['"\[\]]$/g, ''));
                    }
                });
            } catch (e) {
                console.error('解析Frontmatter失败:', e);
            }
        }
        
        return frontmatter;
    }
    
    // 获取仓库中的 Markdown 文件列表（带缓存）
    async function fetchMarkdownFiles() {
        try {
            // 检查缓存
            const cacheKey = 'file-list';
            const cachedData = await getFromCache(cacheKey);
            
            if (cachedData) {
                allFiles = cachedData;
                displayFileList(allFiles);
                loadInitialFile(allFiles);
                return;
            }
            
            // 替换为你的 GitHub 用户名和仓库名
            const repo = 'huanhuan0812/mylife';
            const branch = 'main'; // 或 'master'
            
            const response = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
            
            if (!response.ok) {
                throw new Error('无法获取文件列表');
            }
            
            const data = await response.json();
            allFiles = data.tree
                .filter(item => item.path.endsWith('.md') && item.type === 'blob')
                .map(item => item.path);
            
            // 存入缓存
            await saveToCache(cacheKey, allFiles);
            
            displayFileList(allFiles);
            loadInitialFile(allFiles);
            
        } catch (error) {
            console.error('获取文件列表失败:', error);
            fileListContainer.innerHTML = '<p>无法加载文件列表</p>';
        }
    }
    
    // 搜索文件
    function searchFiles() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            displayFileList(allFiles);
            return;
        }
        
        const filteredFiles = allFiles.filter(file => {
            const metadata = fileMetadata[file] || {};
            const fileName = file.split('/').pop().toLowerCase();
            const title = (metadata.title || '').toLowerCase();
            const tags = (metadata.tags || []).join(' ').toLowerCase();
            
            return fileName.includes(searchTerm) || 
                   title.includes(searchTerm) || 
                   tags.includes(searchTerm);
        });
        
        displayFileList(filteredFiles);
    }
    
    // 从缓存加载初始文件
    function loadInitialFile(files) {
        const params = new URLSearchParams(window.location.search);
        const fileParam = params.get('file');
        
        if (fileParam && files.includes(fileParam)) {
            loadMarkdownFile(fileParam);
        } else if (files.length > 0) {
            loadMarkdownFile(files[0]);
        }
    }
    
    // 从缓存获取数据
    async function getFromCache(key) {
        if (!('caches' in window)) return null;
        
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await cache.match(`https://cache/${key}`);
            
            if (!response) return null;
            
            return await response.json();
        } catch (error) {
            console.error('从缓存读取失败:', error);
            return null;
        }
    }
    
    // 保存数据到缓存
    async function saveToCache(key, data) {
        if (!('caches' in window)) return;
        
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = new Response(JSON.stringify(data), {
                headers: {
                    'date': new Date().toUTCString(),
                    'content-type': 'application/json'
                }
            });
            
            await cache.put(`https://cache/${key}`, response);
        } catch (error) {
            console.error('保存到缓存失败:', error);
        }
    }
    
    // 加载Markdown文件（带缓存）
    async function loadMarkdownFile(filename) {
        currentFile = filename;
        
        // 检查缓存
        const cacheKey = `file-${filename}`;
        const cachedContent = await getFromCache(cacheKey);
        
        if (cachedContent) {
            const { content, frontmatter } = cachedContent;
            fileMetadata[filename] = frontmatter;
            renderMarkdown(content, frontmatter);
            updateActiveFile(filename);
            history.pushState(null, '', `?file=${encodeURIComponent(filename)}`);
            return;
        }
        
        try {
            // 使用 GitHub 原始内容链接
            const response = await fetch(`https://raw.githubusercontent.com/huanhuan0812/mylife/main/${filename}`);
            
            if (!response.ok) {
                throw new Error('文件加载失败');
            }
            
            const markdownText = await response.text();
            const frontmatter = parseFrontmatter(markdownText);
            fileMetadata[filename] = frontmatter;
            
            // 移除Frontmatter部分（如果有）
            const content = markdownText.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
            
            renderMarkdown(content, frontmatter);
            
            // 存入缓存
            await saveToCache(cacheKey, { content, frontmatter });
            
            history.pushState(null, '', `?file=${encodeURIComponent(filename)}`);
            updateActiveFile(filename);
            
        } catch (error) {
            console.error('加载 Markdown 文件失败:', error);
            markdownContent.innerHTML = `<p>无法加载文件: ${filename}</p>`;
        }
    }
    
    // 渲染Markdown内容
    function renderMarkdown(content, frontmatter) {
        let html = '';
        
        // 添加标题和标签
        if (frontmatter.title) {
            html += `<h1>${frontmatter.title}</h1>`;
        }
        
        if (frontmatter.tags && frontmatter.tags.length > 0) {
            html += `<div class="tags">`;
            html += `<span class="tags-label">标签:</span>`;
            frontmatter.tags.forEach(tag => {
                html += `<span class="tag">${tag}</span>`;
            });
            html += `</div>`;
        }
        
        html += marked.parse(content);
        markdownContent.innerHTML = html;
    }
    
    // 更新活动文件样式
    function updateActiveFile(filename) {
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.toggle('active', item.dataset.path === filename);
        });
    }
    
    function displayFileList(files) {
        if (files.length === 0) {
            fileListContainer.innerHTML = '<div class="no-results">没有找到匹配的文件</div>';
            return;
        }
        
        fileListContainer.innerHTML = '';
        
        files.forEach(file => {
            const fileName = file.split('/').pop();
            const metadata = fileMetadata[file] || {};
            const displayName = metadata.title || fileName;
            
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            // 添加文件信息
            fileItem.innerHTML = `
                <div class="file-title">${displayName}</div>
                ${metadata.tags && metadata.tags.length > 0 ? 
                    `<div class="file-tags">${metadata.tags.map(tag => `<span>${tag}</span>`).join('')}</div>` : ''}
            `;
            
            fileItem.dataset.path = file;
            
            fileItem.addEventListener('click', () => {
                loadMarkdownFile(file);
            });
            
            fileListContainer.appendChild(fileItem);
        });
        
        // 如果有当前活动文件且在显示列表中，保持其高亮状态
        if (currentFile && files.includes(currentFile)) {
            updateActiveFile(currentFile);
        }
    }
    
    // 事件监听器
    window.addEventListener('popstate', function() {
        const params = new URLSearchParams(window.location.search);
        const fileParam = params.get('file');
        
        if (fileParam && fileParam !== currentFile) {
            loadMarkdownFile(fileParam);
        }
    });
    
    searchButton.addEventListener('click', searchFiles);
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            searchFiles();
        }
    });
    
    // 初始化
    initCache();
    fetchMarkdownFiles();
});