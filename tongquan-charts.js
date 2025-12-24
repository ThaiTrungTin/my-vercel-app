
import { sb, currentUser } from './app.js';

export const STATUS_CONFIG = {
    'Hết hạn sử dụng': { color: '#ef4444', order: 0 },
    'Từ 1-30 ngày': { color: '#f87171', order: 1 },
    'Từ 31-60 ngày': { color: '#f97316', order: 2 },
    'Từ 61-90 ngày': { color: '#fb923c', order: 3 },
    'Từ 91-120 ngày': { color: '#fbbf24', order: 4 },
    'Từ 121-150 ngày': { color: '#facc15', order: 5 },
    'Từ 151-180 ngày': { color: '#fef08a', order: 6 },
    'Trên 180 ngày': { color: '#16a34a', order: 7 },
    'Còn sử dụng': { color: '#31D134', order: 8 },
    'Cận date': { color: '#36A2EB', order: 9 },
    'Hàng hư': { color: '#F2F208', order: 10 },
    'Không có date': { color: '#9ca3af', order: 11 }
};

let activityChart = null;
let inventoryStatusChart = null;
let regionLineChart = null;
let recipientStackedBarChart = null;

const SKU_COLORS = [
    '#4F46E5', '#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316', '#A855F7',
    '#C026D3', '#16A34A', '#2563EB', '#D97706', '#0891B2', '#4D7C0F'
];

export function renderActivityChart(data, mode) {
    const ctx = document.getElementById('tq-activity-chart')?.getContext('2d');
    if (!ctx) return;
    const last30 = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last30[d.toISOString().split('T')[0]] = { nhap: 0, xuat: 0, balance: 0 };
    }
    data.forEach(item => {
        if (!item.thoi_gian) return;
        const k = item.thoi_gian.split('T')[0];
        if (last30[k]) {
            if (mode === 'quantity') { 
                last30[k].nhap += (parseFloat(item.nhap) || 0); 
                last30[k].xuat += (parseFloat(item.xuat) || 0); 
            }
            else { 
                if((parseFloat(item.nhap) || 0) > 0) last30[k].nhap++; 
                if((parseFloat(item.xuat) || 0) > 0) last30[k].xuat++; 
            }
        }
    });
    Object.values(last30).forEach(d => d.balance = d.nhap - d.xuat);
    
    if (activityChart) activityChart.destroy();
    
    const labels = Object.keys(last30).map(k => {
        const d = new Date(k);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Nhập', data: Object.values(last30).map(d => d.nhap), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderRadius: 4, order: 2 },
                { label: 'Xuất', data: Object.values(last30).map(d => d.xuat), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 4, order: 3 },
                { label: 'Biến động', type: 'line', data: Object.values(last30).map(d => d.balance), borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: false, borderWidth: 2, pointRadius: 2, order: 1 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } } },
                tooltip: { padding: 10, bodyFont: { size: 11 } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                y: { beginAtZero: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

export async function renderInventoryStatusChart(selectedNganh) {
    const ctx = document.getElementById('tq-inventory-chart')?.getContext('2d');
    if (!ctx) return;
    const isM = window.innerWidth <= 768;
    let q = sb.from('ton_kho_update').select('tinh_trang, ton_cuoi');
    if (currentUser.phan_quyen !== 'Admin') {
        const allowed = (currentUser.xem_data || '').split(',').filter(Boolean);
        if (allowed.length > 0) q = q.or(`phu_trach.eq."${currentUser.ho_ten}",nganh.in.(${allowed.map(n => `"${n}"`).join(',')})`);
        else q = q.eq('phu_trach', currentUser.ho_ten);
    }
    if (selectedNganh.length > 0) q = q.in('nganh', selectedNganh);
    const { data } = await q;
    const map = {}; let total = 0;
    (data || []).forEach(i => { const s = i.tinh_trang || 'Không có date'; map[s] = (map[s] || 0) + (i.ton_cuoi || 0); });
    const sorted = Object.keys(map).filter(s => map[s] > 0).sort((a,b) => (STATUS_CONFIG[a]?.order ?? 999) - (STATUS_CONFIG[b]?.order ?? 999));
    sorted.forEach(s => total += map[s]);

    if (inventoryStatusChart) inventoryStatusChart.destroy();
    inventoryStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: sorted, datasets: [{ data: sorted.map(s => map[s]), backgroundColor: sorted.map(s => STATUS_CONFIG[s]?.color || '#9ca3af') }] },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right', labels: {
                        usePointStyle: true, font: { size: isM ? 8 : 11, weight: '700' },
                        generateLabels: (chart) => chart.data.labels.map((l, i) => {
                            const v = chart.data.datasets[0].data[i];
                            return { text: `${l}: ${v.toLocaleString()} (${total>0?((v/total)*100).toFixed(1):0}%)`, fillStyle: chart.data.datasets[0].backgroundColor[i], strokeStyle: 'transparent', index: i };
                        })
                    }
                }
            }
        }
    });
}

export function renderRegionLineChart(regionMap) {
    const ctx = document.getElementById('tq-region-line-chart')?.getContext('2d');
    if (!ctx) return;

    const isDesktop = window.innerWidth > 768;
    const labels = Object.keys(regionMap).sort();
    const nhap = labels.map(l => regionMap[l].nhap);
    const xuat = labels.map(l => regionMap[l].xuat);
    const thieu = labels.map(l => regionMap[l].thieu);

    if (regionLineChart) regionLineChart.destroy();
    regionLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Nhập', data: nhap, borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.1)', tension: 0.3, fill: true, pointStyle: 'circle', pointRadius: isDesktop ? 6 : 4, borderWidth: isDesktop ? 3 : 2 },
                { label: 'Xuất', data: xuat, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.3, fill: true, pointStyle: 'rectRot', pointRadius: isDesktop ? 6 : 4, borderWidth: isDesktop ? 3 : 2 },
                { label: 'Thiếu', data: thieu, borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.3, fill: true, pointStyle: 'triangle', pointRadius: isDesktop ? 7 : 5, borderWidth: isDesktop ? 3 : 2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: { 
                legend: { 
                    display: true, 
                    position: isDesktop ? 'top' : 'top',
                    align: 'end',
                    labels: {
                        boxWidth: isDesktop ? 25 : 12,
                        padding: isDesktop ? 20 : 10,
                        usePointStyle: true,
                        font: {
                            size: isDesktop ? 13 : 9,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: { 
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13, weight: '600' },
                    usePointStyle: true
                } 
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#F3F4F6', lineWidth: 1 }, ticks: { font: { size: isDesktop ? 11 : 9, weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { font: { size: isDesktop ? 12 : 9, weight: 'bold' } } }
            }
        }
    });
}

export function renderRecipientStackedBarChart(recipientData) {
    const ctx = document.getElementById('tq-recipient-stacked-bar-chart')?.getContext('2d');
    if (!ctx) return;

    const sortedEntries = Object.entries(recipientData)
        .sort((a, b) => {
            const totalA = Object.values(a[1].counts).reduce((s, v) => s + v, 0);
            const totalB = Object.values(b[1].counts).reduce((s, v) => s + v, 0);
            return totalB - totalA;
        })
        .slice(0, 10);
    
    const labels = sortedEntries.map(e => e[0]);
    const skuCounts = sortedEntries.map(e => e[1].skuCount);
    const allSKUs = new Set();
    sortedEntries.forEach(e => {
        Object.keys(e[1].counts).forEach(sku => allSKUs.add(sku));
    });
    
    const datasets = Array.from(allSKUs).map((sku, idx) => ({
        label: sku,
        data: labels.map(name => (recipientData[name] && recipientData[name].counts[sku]) || 0),
        backgroundColor: SKU_COLORS[idx % SKU_COLORS.length],
        barThickness: window.innerWidth > 768 ? 25 : 18,
        borderRadius: 4,
        yAxisID: 'y'
    }));

    // Thêm dataset Line cho SKU Count
    datasets.push({
        label: 'Số loại mặt hàng',
        data: skuCounts,
        type: 'line',
        borderColor: '#10B981',
        backgroundColor: 'white',
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#10B981',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        order: -1 // Đưa đường lên trên các cột
    });

    if (recipientStackedBarChart) recipientStackedBarChart.destroy();
    recipientStackedBarChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    padding: 10,
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.raw !== undefined) label += context.raw.toLocaleString();
                            return label;
                        }
                    }
                } 
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } },
                y: { 
                    stacked: true, 
                    beginAtZero: true, 
                    grid: { color: '#F3F4F6' }, 
                    ticks: { font: { size: 10 } },
                    title: { display: true, text: 'Tổng số lượng', font: { size: 10, weight: 'bold' } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false },
                    ticks: { font: { size: 10, weight: 'bold' }, stepSize: 1 },
                    title: { display: true, text: 'Số loại hàng', font: { size: 10, weight: 'bold' } }
                }
            }
        }
    });
}
