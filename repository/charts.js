// 图表工具函数可以放在这里
// 当前我们直接在details.js中实现了图表渲染
// 如果需要更复杂的图表，可以在这里封装

function createChart(canvasId, type, data, options) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: type,
        data: data,
        options: options
    });
}

// 其他图表相关工具函数...