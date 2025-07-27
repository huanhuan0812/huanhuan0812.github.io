document.addEventListener('DOMContentLoaded', function() {
    // 初始化主题
    initTheme();
    
    // 获取文档列表
    fetchDocumentList();
    
    // 处理URL哈希变化
    window.addEventListener('hashchange', loadDocumentFromHash);
    
    // 初始化搜索功能
    initSearch();
    
    // 初始化目录按钮
    initTocToggle();
});

// 文档数据缓存
let allDocs = [];
let searchIndex = [];

// 初始化主题
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // 应用保存的主题
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // 切换主题事件
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

// 更新主题图标
function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (theme === 'dark') {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
}

// 初始化目录切换
function initTocToggle() {
    const tocContainer = document.getElementById('toc-container');
    const tocToggle = document.querySelector('.toc-toggle');
    
    tocToggle.addEventListener('click', () => {
        tocContainer.style.display = 'none';
    });
}

// 获取文档列表
async function fetchDocumentList() {
    try {
        // 模拟API请求 - 实际应用中替换为真实API调用
        // const response = await fetch('docs-list.json');
        // allDocs = await response.json();
        
        // 硬编码文档列表 - 实际应用中可以从服务器获取
        allDocs = [
            { name: "介绍", file: "introduction.md", icon: "fa-file-alt" },
            { name: "快速开始", file: "getting-started.md", icon: "fa-rocket" },
            { name: "高级用法", file: "advanced-usage.md", icon: "fa-cogs" },
            { name: "API参考", file: "api-reference.md", icon: "fa-code" }
        ];
        
        renderSidebar(allDocs);
        
        // 预加载搜索索引
        await buildSearchIndex();
        
        // 检查URL哈希并加载相应文档
        if (window.location.hash) {
            loadDocumentFromHash();
        }
    } catch (error) {
        console.error('获取文档列表失败:', error);
        document.getElementById('sidebar-content').innerHTML = 
            '<p>无法加载文档列表</p>';
    }
}

// 渲染侧边栏
function renderSidebar(docs) {
    const sidebar = document.getElementById('sidebar-content');
    sidebar.innerHTML = '';
    
    docs.forEach(doc => {
        const link = document.createElement('a');
        link.href = `#${doc.file}`;
        link.className = 'doc-link';
        link.innerHTML = `<i class="fas ${doc.icon || 'fa-file-alt'}"></i> ${doc.name}`;
        link.dataset.file = doc.file;
        sidebar.appendChild(link);
    });
}

// 加载文档内容
async function loadDocumentFromHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) return;
    
    // 高亮当前选中的文档链接
    document.querySelectorAll('.doc-link').forEach(link => {
        link.classList.toggle('active', link.dataset.file === hash);
    });
    
    try {
        // 显示加载状态
        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = '<div class="loading-container"><p>加载中...</p></div>';
        
        // 获取文档内容
        const response = await fetch(`docs/${hash}`);
        const markdown = await response.text();
        
        // 渲染Markdown
        renderMarkdown(markdown);
        
        // 生成目录
        generateTOC();
        
        // 显示目录
        document.getElementById('toc-container').style.display = 'block';
    } catch (error) {
        console.error('加载文档失败:', error);
        document.getElementById('content').innerHTML = `
            <div class="error-message">
                <h2>无法加载文档</h2>
                <p>请检查文档是否存在或稍后再试。</p>
            </div>
        `;
    }
}

// 渲染Markdown内容
function renderMarkdown(markdown) {
    const contentDiv = document.getElementById('content');
    
    // 使用DOMPurify清理HTML以防止XSS攻击
    const unsafeHtml = marked.parse(markdown);
    const cleanHtml = DOMPurify.sanitize(unsafeHtml);
    
    contentDiv.innerHTML = `
        <div class="markdown-content">
            ${cleanHtml}
        </div>
    `;
    
    // 为所有标题添加锚点
    contentDiv.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
        const id = heading.textContent.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        heading.id = id;
        
        const anchor = document.createElement('a');
        anchor.href = `#${id}`;
        anchor.className = 'heading-anchor';
        anchor.innerHTML = '#';
        heading.appendChild(anchor);
    });
}

// 生成目录
function generateTOC() {
    const contentDiv = document.getElementById('content');
    const headings = contentDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const tocContent = document.getElementById('toc-content');
    
    if (headings.length === 0) {
        tocContent.innerHTML = '<p>此文档没有标题</p>';
        return;
    }
    
    let tocHtml = '<ul>';
    let lastLevel = 1;
    
    headings.forEach(heading => {
        const level = parseInt(heading.tagName.substring(1));
        const id = heading.id;
        const text = heading.textContent.replace('#', '');
        
        // 处理层级关系
        if (level > lastLevel) {
            for (let i = lastLevel; i < level; i++) {
                tocHtml += '<ul>';
            }
        } else if (level < lastLevel) {
            for (let i = level; i < lastLevel; i++) {
                tocHtml += '</ul></li>';
            }
        } else {
            tocHtml += '</li>';
        }
        
        tocHtml += `<li class="toc-h${level}"><a href="#${id}">${text}</a>`;
        lastLevel = level;
    });
    
    // 关闭所有打开的标签
    for (let i = 1; i < lastLevel; i++) {
        tocHtml += '</ul></li>';
    }
    
    tocHtml += '</ul>';
    tocContent.innerHTML = tocHtml;
}

// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    searchInput.parentNode.appendChild(searchResults);
    
    // 搜索输入事件
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        const results = searchDocuments(query);
        displaySearchResults(results, searchResults);
    });
    
    // 点击外部关闭搜索结果
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            searchResults.style.display = 'none';
        }
    });
}

// 构建搜索索引
async function buildSearchIndex() {
    searchIndex = [];
    
    // 为每个文档构建索引
    for (const doc of allDocs) {
        try {
            const response = await fetch(`docs/${doc.file}`);
            const content = await response.text();
            
            // 移除Markdown标记和代码块
            const plainText = content
                .replace(/```[\s\S]*?```/g, '') // 移除代码块
                .replace(/`[^`]+`/g, '')        // 移除行内代码
                .replace(/[#*\-_\[\]!<>]/g, '') // 移除Markdown标记
                .replace(/\s+/g, ' ')           // 合并空格
                .trim();
            
            searchIndex.push({
                doc,
                content: plainText.toLowerCase()
            });
        } catch (error) {
            console.error(`无法索引文档 ${doc.file}:`, error);
        }
    }
}

// 搜索文档
function searchDocuments(query) {
    const queryLower = query.toLowerCase();
    const results = [];
    
    searchIndex.forEach((item, index) => {
        const content = item.content;
        const positions = [];
        
        // 查找所有匹配位置
        let pos = content.indexOf(queryLower);
        while (pos !== -1) {
            positions.push(pos);
            pos = content.indexOf(queryLower, pos + 1);
        }
        
        if (positions.length > 0) {
            // 获取匹配周围的文本作为摘要
            const firstPos = positions[0];
            const start = Math.max(0, firstPos - 20);
            const end = Math.min(content.length, firstPos + query.length + 60);
            let excerpt = content.substring(start, end);
            
            // 高亮匹配文本
            excerpt = excerpt.replace(new RegExp(queryLower, 'gi'), 
                match => `<span class="search-highlight">${match}</span>`);
            
            // 如果不在开头，添加省略号
            if (start > 0) excerpt = '...' + excerpt;
            if (end < content.length) excerpt = excerpt + '...';
            
            results.push({
                doc: item.doc,
                excerpt,
                score: positions.length * 10 + query.length // 简单评分算法
            });
        }
    });
    
    // 按评分排序
    results.sort((a, b) => b.score - a.score);
    return results;
}

// 显示搜索结果
function displaySearchResults(results, container) {
    if (results.length === 0) {
        container.innerHTML = '<div class="search-result-item">没有找到匹配的文档</div>';
        container.style.display = 'block';
        return;
    }
    
    let html = '';
    results.slice(0, 5).forEach(result => {
        html += `
            <div class="search-result-item" data-file="${result.doc.file}">
                <strong>${result.doc.name}</strong>
                <p>${result.excerpt}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // 点击搜索结果加载文档
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            window.location.hash = item.dataset.file;
            container.style.display = 'none';
            document.getElementById('search-input').value = '';
        });
    });
}