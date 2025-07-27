document.addEventListener('DOMContentLoaded', function() {
    const fileListContainer = document.getElementById('file-list');
    const markdownContent = document.getElementById('markdown-content');
    let currentFile = null;
    
    // 获取仓库中的 Markdown 文件列表
    async function fetchMarkdownFiles() {
        try {
            // 替换为你的 GitHub 用户名和仓库名
            const repo = 'huanhuan0812/mylife';
            const branch = 'main'; // 或 'master'
            
            const response = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
            
            if (!response.ok) {
                throw new Error('无法获取文件列表');
            }
            
            const data = await response.json();
            const mdFiles = data.tree
                .filter(item => item.path.endsWith('.md') && item.type === 'blob')
                .map(item => item.path);
            
            displayFileList(mdFiles);
            
            // 检查 URL 参数
            const params = new URLSearchParams(window.location.search);
            const fileParam = params.get('file');
            
            if (fileParam && mdFiles.includes(fileParam)) {
                loadMarkdownFile(fileParam);
            } else if (mdFiles.length > 0) {
                loadMarkdownFile(mdFiles[0]);
            }
            
        } catch (error) {
            console.error('获取文件列表失败:', error);
            fileListContainer.innerHTML = '<p>无法加载文件列表</p>';
        }
    }
    
    function displayFileList(files) {
        if (files.length === 0) {
            fileListContainer.innerHTML = '<p>没有找到 Markdown 文件</p>';
            return;
        }
        
        fileListContainer.innerHTML = '';
        
        files.forEach(file => {
            const fileName = file.split('/').pop();
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.textContent = fileName;
            fileItem.dataset.path = file;
            
            fileItem.addEventListener('click', () => {
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                fileItem.classList.add('active');
                loadMarkdownFile(file);
            });
            
            fileListContainer.appendChild(fileItem);
        });
    }
    
    async function loadMarkdownFile(filename) {
        currentFile = filename;
        
        try {
            // 使用 GitHub 原始内容链接
            const response = await fetch(`https://raw.githubusercontent.com/${repo}/main/${filename}`);
            
            if (!response.ok) {
                throw new Error('文件加载失败');
            }
            
            const markdownText = await response.text();
            markdownContent.innerHTML = marked.parse(markdownText);
            history.pushState(null, '', `?file=${encodeURIComponent(filename)}`);
            
        } catch (error) {
            console.error('加载 Markdown 文件失败:', error);
            markdownContent.innerHTML = `<p>无法加载文件: ${filename}</p>`;
        }
    }
    
    window.addEventListener('popstate', function() {
        const params = new URLSearchParams(window.location.search);
        const fileParam = params.get('file');
        
        if (fileParam && fileParam !== currentFile) {
            loadMarkdownFile(fileParam);
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.toggle('active', item.dataset.path === fileParam);
            });
        }
    });
    
    fetchMarkdownFiles();
});