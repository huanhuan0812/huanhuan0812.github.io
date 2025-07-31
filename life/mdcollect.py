import os
import re
import json
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Optional

def json_serializer(obj):
    """自定义JSON序列化器，处理日期等特殊对象"""
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def extract_frontmatter(md_content: str) -> Optional[Dict]:
    """从Markdown内容中提取Frontmatter（YAML格式），支持多行数据"""
    frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
    match = re.match(frontmatter_pattern, md_content, re.DOTALL)
    
    if not match:
        return None
    
    frontmatter_str = match.group(1)
    try:
        import yaml
        frontmatter = yaml.load(frontmatter_str, Loader=yaml.FullLoader)
        return frontmatter if isinstance(frontmatter, dict) else None
    except ImportError:
        print("警告：PyYAML未安装，请运行: pip install pyyaml")
        return None
    except Exception as e:
        print(f"Frontmatter解析错误: {e}")
        return None

def process_markdown_files(docs_dir: Path) -> List[Dict]:
    """处理指定目录中的所有Markdown文件"""
    results = []
    
    if not docs_dir.exists():
        print(f"错误：目录 {docs_dir.absolute()} 不存在")
        return results
    
    for md_file in docs_dir.glob('**/*.md'):
        try:
            content = md_file.read_text(encoding='utf-8')
            rel_path = md_file.relative_to(docs_dir)
            
            results.append({
                'filename': md_file.name,
                'path': str(rel_path).replace('\\', '/'),
                'frontmatter': extract_frontmatter(content),
                'has_content': bool(content.split('---', 2)[-1].strip())
            })
        except Exception as e:
            print(f"处理文件 {md_file} 时出错: {e}")
    
    return results

def main():
    script_dir = Path(__file__).parent
    docs_dir = script_dir / "docs"
    
    print(f"脚本目录: {script_dir}")
    print(f"正在从 {docs_dir} 收集Markdown文件...")
    
    markdown_data = process_markdown_files(docs_dir)
    
    if not markdown_data:
        print(f"未找到Markdown文件，请检查目录: {docs_dir.absolute()}")
        return
    
    output_file = docs_dir / "markdown_list.json"
    try:
        with output_file.open('w', encoding='utf-8') as f:
            json.dump(markdown_data, f, 
                     ensure_ascii=False, 
                     indent=2,
                     default=json_serializer)  # 使用自定义序列化器
        print(f"成功保存 {len(markdown_data)} 个文件信息到 {output_file}")
    except Exception as e:
        print(f"保存失败: {e}")

if __name__ == '__main__':
    main()