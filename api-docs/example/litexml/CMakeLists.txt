cmake_minimum_required(VERSION 3.20)
project(testmdqt LANGUAGES CXX)

# 设置 C++23 标准
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# 设置查找路径
list(APPEND CMAKE_PREFIX_PATH ~/libtest/macos)

# 打印路径用于调试
message(STATUS "CMAKE_PREFIX_PATH: ${CMAKE_PREFIX_PATH}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")

# 查找 litexml
find_package(litexml REQUIRED)

# 打印找到的信息
message(STATUS "LITEXML_FOUND: ${LITEXML_FOUND}")
message(STATUS "LITEXML_INCLUDE_DIR: ${LITEXML_INCLUDE_DIR}")
message(STATUS "LITEXML_LIBRARY: ${LITEXML_LIBRARY}")

add_executable(testmdqt main.cpp)

# 链接库
target_link_libraries(testmdqt litexml::litexml)

# 确保使用 C++23
target_compile_features(testmdqt PUBLIC cxx_std_23)