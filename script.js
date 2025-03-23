// Set chart dimensions
const width = 900;
const height = 500;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };

// Select the SVG and set dimensions
const svg = d3.select("#chart")
    .attr("width", width)
    .attr("height", height);

// Generate 4 hours (240 minutes) of consistent candlestick data
const generateData = () => {
    let data = [];
    let startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 239); // Start from 4 hours ago
    let price = 100; // Initial price

    for (let i = 0; i < 240; i++) {
        let open = price;
        let close = open + (Math.random() * 4 - 2); // Random variation within -2 to +2
        let high = Math.max(open, close) + Math.random() * 2;
        let low = Math.min(open, close) - Math.random() * 2;
        data.push({ 
            date: new Date(startTime), 
            open: open, 
            high: high, 
            low: low, 
            close: close 
        });

        startTime.setMinutes(startTime.getMinutes() + 1); // Move to the next minute
        price = close; // Next candle's open = previous close
    }
    return data;
};

// Generate data
let data = generateData();

// Number of candles displayed at once
let numCandles = 30;
let startIdx = 0;
let endIdx = numCandles - 1;

// X Scale for dynamic time window
let xScale = d3.scaleTime()
    .domain([data[startIdx].date, data[endIdx].date])
    .range([margin.left, width - margin.right]);

const yScale = d3.scaleLinear()
    .domain([d3.min(data, d => d.low) - 1, d3.max(data, d => d.high) + 1])
    .range([height - margin.bottom, margin.top]);

// X & Y Axes
const xAxis = d3.axisBottom(xScale)
    .tickFormat(d3.timeFormat("%H:%M"));

const yAxis = d3.axisLeft(yScale).ticks(6);

// Append X and Y Axes
const gX = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis);

svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis);

// Create a group for the candlestick chart
const chartGroup = svg.append("g");

// Function to update chart dynamically
function updateChart() {
    let visibleData = data.slice(startIdx, endIdx + 1);

    xScale.domain([data[startIdx].date, data[endIdx].date]);
    gX.transition().duration(500).call(xAxis);

    // Update wicks
    let wicks = chartGroup.selectAll("line.wick").data(visibleData);
    wicks.enter()
        .append("line")
        .merge(wicks)
        .transition().duration(500)
        .attr("class", "wick")
        .attr("x1", d => xScale(d.date))
        .attr("x2", d => xScale(d.date))
        .attr("y1", d => yScale(d.high))
        .attr("y2", d => yScale(d.low))
        .attr("stroke", "black");
    wicks.exit().remove();

    // Update candles
    let candleWidth = width / numCandles * 0.8;
    let candles = chartGroup.selectAll("rect.candle").data(visibleData);
    candles.enter()
        .append("rect")
        .merge(candles)
        .transition().duration(500)
        .attr("class", "candle")
        .attr("x", d => xScale(d.date) - candleWidth / 2)
        .attr("y", d => yScale(Math.max(d.open, d.close)))
        .attr("width", candleWidth)
        .attr("height", d => Math.abs(yScale(d.open) - yScale(d.close)))
        .attr("fill", d => d.close > d.open ? "green" : "red");
    candles.exit().remove();
}

// Zoom and pan behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[margin.left, 0], [width - margin.right, height]])
    .on("zoom", zoomed);

svg.call(zoom);

// Zoom function
function zoomed(event) {
    let zoomFactor = event.transform.k;
    let candlesPerView = Math.floor(240 / zoomFactor);
    numCandles = Math.max(30, candlesPerView);

    startIdx = Math.max(0, Math.floor((240 - numCandles) * (1 - 1 / zoomFactor)));
    endIdx = Math.min(239, startIdx + numCandles - 1);

    updateChart();
}

// Animate new candles every 2 seconds without re-rendering everything
let currentIdx = 200; // Start from last 40 candles
function animateCandles() {
    if (currentIdx < 240) {
        // Add new candle and remove the first one to maintain 30 candles in view
        startIdx++;
        endIdx++;
        
        // Update xScale domain
        xScale.domain([data[startIdx].date, data[endIdx].date]);

        // Transition existing candles to the left
        chartGroup.selectAll("rect.candle")
            .transition().duration(1000)
            .attr("x", d => xScale(d.date) - (width / numCandles) * 0.4);

        chartGroup.selectAll("line.wick")
            .transition().duration(1000)
            .attr("x1", d => xScale(d.date))
            .attr("x2", d => xScale(d.date));

        // Add new candle (only one) at the right side
        let newCandle = data[endIdx]; // Get new candle data

        // Append the new candle smoothly
        let candleWidth = width / numCandles * 0.8;
        chartGroup.append("rect")
            .datum(newCandle)
            .attr("class", "candle")
            .attr("x", xScale(newCandle.date) + candleWidth) // Start slightly outside view
            .attr("y", yScale(Math.max(newCandle.open, newCandle.close)))
            .attr("width", candleWidth)
            .attr("height", Math.abs(yScale(newCandle.open) - yScale(newCandle.close)))
            .attr("fill", newCandle.close > newCandle.open ? "green" : "red")
            .transition().duration(1000)
            .attr("x", xScale(newCandle.date) - candleWidth / 2); // Slide into position

        // Append the new wick smoothly
        chartGroup.append("line")
            .datum(newCandle)
            .attr("class", "wick")
            .attr("x1", xScale(newCandle.date) + candleWidth) // Start outside
            .attr("x2", xScale(newCandle.date) + candleWidth)
            .attr("y1", yScale(newCandle.high))
            .attr("y2", yScale(newCandle.low))
            .attr("stroke", "black")
            .transition().duration(1000)
            .attr("x1", xScale(newCandle.date))
            .attr("x2", xScale(newCandle.date));

        // Remove the first candle to keep only 30 visible
        if (chartGroup.selectAll(".candle").size() > numCandles) {
            chartGroup.selectAll(".candle").filter((d, i) => i === 0).remove();
            chartGroup.selectAll(".wick").filter((d, i) => i === 0).remove();
        }

        // Update x-axis
        gX.transition().duration(1000).call(xAxis);

        currentIdx++;
        setTimeout(animateCandles, 2000);
    }
}

// Initialize with first 30 candles
updateChart();

// Start animation after 1 second
setTimeout(animateCandles, 1000);
