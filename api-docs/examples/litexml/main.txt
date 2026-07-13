#include <xml_parser.h>
#include <iostream>
#include <memory>
#include <vector>

int main() {
    std::cout << "Testing litexml library (C++23)" << std::endl;
    std::cout << "================================" << std::endl;
    
    litexml::XMLParser parser;
    
    std::string xml = R"(<?xml version="1.0" encoding="UTF-8"?>
<root>
    <child name="test">Hello World</child>
    <empty/>
    <child>Another</child>
</root>)";
    
    std::cout << "Parsing XML..." << std::endl;
    auto result = parser.parse(xml);
    
    if (result) {
        std::cout << "✅ Parse successful!" << std::endl;
        auto& doc = *result;
        if (doc) {
            auto* root = doc->getDocumentElement();
            if (root) {
                std::cout << "Root element: " << root->getTagName() << std::endl;
                std::cout << "Number of children: " << root->children.size() << std::endl;
                
                // 遍历所有子节点
                std::cout << "\nChildren:" << std::endl;
                for (auto* child : root->children) {
                    switch (child->type) {
                        case litexml::NodeType::Element: {
                            auto* elem = static_cast<litexml::ElementNode*>(child);
                            std::cout << "  [Element] " << elem->getTagName();
                            
                            // 获取属性
                            if (elem->getAttributes().size() > 0) {
                                std::cout << " (";
                                bool first = true;
                                for (const auto& [key, value] : elem->getAttributes()) {
                                    if (!first) std::cout << ", ";
                                    std::cout << key << "=\"" << value << "\"";
                                    first = false;
                                }
                                std::cout << ")";
                            }
                            
                            // 检查文本内容
                            auto textChild = elem->getFirstChild();
                            if (textChild && textChild.value()->type == litexml::NodeType::Text) {
                                auto* textNode = static_cast<litexml::TextNode*>(textChild.value());
                                auto text = textNode->getText();
                                if (!text.empty()) {
                                    std::cout << " -> \"" << text << "\"";
                                }
                            }
                            std::cout << std::endl;
                            break;
                        }
                        case litexml::NodeType::Text: {
                            auto* text = static_cast<litexml::TextNode*>(child);
                            auto content = text->getText();
                            if (!content.empty() && content.find_first_not_of(" \t\n\r") != std::string_view::npos) {
                                std::cout << "  [Text] \"" << content << "\"" << std::endl;
                            }
                            break;
                        }
                        case litexml::NodeType::Comment:
                            std::cout << "  [Comment] " << static_cast<litexml::CommentNode*>(child)->getComment() << std::endl;
                            break;
                        case litexml::NodeType::CData:
                            std::cout << "  [CDATA] " << static_cast<litexml::CDataNode*>(child)->getData() << std::endl;
                            break;
                        default:
                            std::cout << "  [Other Node Type]" << std::endl;
                            break;
                    }
                }
                
                // 使用 getElementsByTagName 查找特定元素
                auto childElements = doc->getElementsByTagName("child");
                std::cout << "\nElements with tag 'child': " << childElements.size() << std::endl;
                for (auto* elem : childElements) {
                    std::cout << "  - " << elem->getTagName();
                    auto attr = elem->getAttribute("name");
                    if (attr) {
                        std::cout << " (name=\"" << *attr << "\")";
                    }
                    std::cout << std::endl;
                }
            }
        }
    } else {
        std::cout << "❌ Parse failed!" << std::endl;
        const auto& error = result.error();
        std::cout << "Error code: " << static_cast<int>(error.error) << std::endl;
        std::cout << "Message: " << error.message << std::endl;
        if (error.position) {
            std::cout << "Position: " << *error.position << std::endl;
        }
    }
    
    std::cout << "================================" << std::endl;
    std::cout << "Test completed!" << std::endl;
    
    return 0;
}