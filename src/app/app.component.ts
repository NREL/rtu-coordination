import * as am4charts from '@amcharts/amcharts4/charts';
import * as am4core from '@amcharts/amcharts4/core';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';
// import am4themes_themes_dark from '@amcharts/amcharts4/themes/dark.js';
import { AfterViewInit, Component, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { MatSliderChange } from '@angular/material/slider';
import { Papa } from 'ngx-papaparse';
import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

// am4core.useTheme(am4themes_themes_dark);
am4core.useTheme(am4themes_animated);

type ViewType = 'rtu' | 'ev';

export interface Record {
  Time: Date;
  'Bldg (kW) UnCoord': number;
  'Peak Running (kW) UnCoord': number;
  'Bldg RTU (kW) UnCoord': number;
  'Bldg Other (kW) UnCoord': number;
  'RTU On Count UnCoord': number;
  'RTU 1 State UnCoord': number;
  'RTU 2 State UnCoord': number;
  'RTU 3 State UnCoord': number;
  'RTU 4 State UnCoord': number;
  'RTU 5 State UnCoord': number;
  'RTU 6 State UnCoord': number;
  'Bldg + EV (kW) UnCoord': number;
  'Bldg (kW) Coord': number;
  'Peak Running (kW) Coord': number;
  'Bldg RTU (kW) Coord': number;
  'Bldg Other (kW) Coord': number;
  'RTU On Count Coord': number;
  'RTU 1 State Coord': number;
  'RTU 2 State Coord': number;
  'RTU 3 State Coord': number;
  'RTU 4 State Coord': number;
  'RTU 5 State Coord': number;
  'RTU 6 State Coord': number;
  'Port 1 (kW)': number;
  'Port 2 (kW)': number;
  'Bldg + EV (kW) Coord': number;
  'Bldg + EV + ESS (kW) Coord': number;
  'Peak EV (kW) Coord': number;
  'Peak ESS (kW) Coord': number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy, OnInit {
  duration = 60;
  interval: number | undefined;
  playing = false;
  timeIndex = {
    current: 0,
    min: 0,
    max: 1438
  };
  rtuData: Record[] = [];
  active: string;
  view: ViewType = 'rtu';
  leftStyle: string;
  rightStyle: string;
  private bars = [];
  private charts: am4charts.XYChart[] = [];
  private dataReady: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private $dataReady = this.dataReady.asObservable();
  private peaks = [];
  private peakUncoord = new Subject<string>();
  private $peakUncoord = this.peakUncoord.asObservable().pipe(distinctUntilChanged());
  private peakCoord = new Subject<string>();
  private $peakCoord = this.peakCoord.asObservable().pipe(distinctUntilChanged());
  private uncoordData: { date: Date; ev: number; rtu: number }[];
  private coordData: { date: Date; ev: number; rtu: number }[];

  constructor(
    private papa: Papa,
    private zone: NgZone
  ) {
    const view = localStorage.getItem('view');
    if (['rtu', 'ev'].includes(view)) {
      this.view = view as ViewType;
    }
  }

  @HostListener('document:keydown.Space')
  handleSpaceKey(): void {
    this.togglePlaying();
  }

  @HostListener('document:keydown.ArrowLeft')
  handleArrowLeftKey(): void {
    if (this.timeIndex.current <= this.timeIndex.min) {
      this.timeIndex.current = this.timeIndex.max;
    } else {
      --this.timeIndex.current;
    }
    this.update(this.timeIndex.current);
  }

  @HostListener('document:keydown.ArrowRight')
  handleArrowRightKey(): void {
    if (this.timeIndex.current >= this.timeIndex.max) {
      this.timeIndex.current = this.timeIndex.min;
    } else {
      ++this.timeIndex.current;
    }
    this.update(this.timeIndex.current);
  }

  onSliderChange($event: MatSliderChange): void {
    this.update($event.value);
  }

  togglePlaying(): void {
    this.playing = !this.playing;
    if (this.playing) {
      this.interval = window.setInterval(() => {
        if (this.timeIndex.current === this.timeIndex.max) {
          this.timeIndex.current = this.timeIndex.min;
        } else {
          ++this.timeIndex.current;
        }
        this.update(this.timeIndex.current);
      }, this.duration / (this.timeIndex.max - this.timeIndex.min) * 1000);
    } else {
      clearInterval(this.interval);
    }
  }

  createChart(id: 'chart-uncoord' | 'chart-coord', data: {}[]): void {
    const chart = am4core.create(id, am4charts.XYChart);

    const topContainer = chart.chartContainer.createChild(am4core.Container);
    topContainer.layout = 'absolute';
    topContainer.toBack();
    topContainer.marginTop = -15;
    topContainer.paddingBottom = 5;
    topContainer.width = am4core.percent(100);

    const title = topContainer.createChild(am4core.Label);
    title.align = 'left';
    title.fontSize = 30;
    if (this.view === 'rtu') {
      title.text = id === 'chart-uncoord' ? 'Base Building' : 'RTU Coordination';
    } else if (this.view === 'ev') {
      title.text = id === 'chart-uncoord' ? 'Base Building + EVs' : 'RTU Coordination + EVs + ESS';
    }
    title.dx = 40;
    title.dy = 6;

    const peak = topContainer.createChild(am4core.Label);
    peak.align = 'right';
    peak.paddingTop = 20;
    peak.text = 'PEAK DEMAND';
    this.peaks.push(peak);

    chart.data = data;
    chart.paddingRight = 24;
    chart.colors.list = [
      id === 'chart-uncoord' ? am4core.color('#283890') : am4core.color('#3ab54a')
    ];

    const dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.dateFormats.setKey('hour', 'ha');
    dateAxis.periodChangeDateFormats.setKey('hour', 'ha');
    // dateAxis.groupData = true;
    // dateAxis.groupInterval = {timeUnit: 'minute', count: 5};

    dateAxis.renderer.grid.template.location = 0;
    dateAxis.renderer.labels.template.dy = -8;
    dateAxis.renderer.minGridDistance = 60;
    dateAxis.title.text = 'TIME (JULY 3RD)';
    dateAxis.title.marginTop = -10;
    dateAxis.title.marginBottom = -5;

    const bar = dateAxis.axisRanges.create();
    bar.date = this.rtuData[0].Time;
    bar.grid.stroke = am4core.color('red');
    bar.grid.strokeWidth = 2;
    bar.grid.strokeOpacity = 1;
    this.bars.push(bar);

    const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.renderer.maxWidth = 22;
    valueAxis.min = 0;
    valueAxis.title.text = 'kW';
    valueAxis.title.dx = -12;
    valueAxis.renderer.labels.template.dx = -20;
    valueAxis.tooltip.disabled = true;

    if (this.view === 'rtu') {
      valueAxis.max = this.rtuData[this.rtuData.length - 1]['Peak Running (kW) UnCoord'];
    } else if (this.view === 'ev') {
      valueAxis.max = this.rtuData[this.rtuData.length - 1]['Peak EV (kW) Coord'];
    }

    // const otherSeries = chart.series.push(new am4charts.LineSeries());
    // otherSeries.dataFields.dateX = 'date';
    // otherSeries.dataFields.valueY = 'base';
    // otherSeries.tooltipText = '{valueY.formatNumber(\'0.0\')} kW';
    // otherSeries.name = 'BASE LOAD';

    const rtuSeries = chart.series.push(new am4charts.LineSeries());
    rtuSeries.dataFields.dateX = 'date';
    rtuSeries.dataFields.valueY = 'rtu';
    rtuSeries.tooltipText = '{valueY.formatNumber(\'0.0\')} kW';
    rtuSeries.hidden = this.view !== 'rtu';
    // rtuSeries.name = 'TOTAL LOAD';

    const evSeries = chart.series.push(new am4charts.LineSeries());
    evSeries.dataFields.dateX = 'date';
    evSeries.dataFields.valueY = 'ev';
    evSeries.tooltipText = '{valueY.formatNumber(\'0.0\')} kW';
    evSeries.hidden = this.view !== 'ev';
    // if (id === 'chart-uncoord') {
    //   evSeries.name = 'BLDG + EV';
    // } else {
    //   evSeries.name = 'BLDG + EV + ESS';
    // }

    // const evSeries = chart.series.push(new am4charts.LineSeries());
    // evSeries.dataFields.dateX = 'date';
    // evSeries.dataFields.valueY = 'ev';
    // evSeries.tooltipText = '{valueY.formatNumber(\'0.0\')} kW';
    // evSeries.name = 'BLDG + EV';
    //
    // const essSeries = chart.series.push(new am4charts.LineSeries());
    // essSeries.dataFields.dateX = 'date';
    // essSeries.dataFields.valueY = 'ess';
    // essSeries.tooltipText = '{valueY.formatNumber(\'0.0\')} kW';
    // essSeries.name = 'BLDG + EV + ESS';

    // const scrollbarX = new am4charts.XYChartScrollbar();
    // scrollbarX.rtuSeries.push(rtuSeries);
    // chart.scrollbarX = scrollbarX;

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.behavior = 'none';
    chart.cursor.events.on('cursorpositionchanged', ev => {
      if (id === 'chart-uncoord' && this.active === 'chart-uncoord') {
        this.updateCursor(1, {
          x: ev.target.xPosition,
          y: ev.target.yPosition
        });
      } else if (id === 'chart-coord' && this.active === 'chart-coord') {
        this.updateCursor(0, {
          x: ev.target.xPosition,
          y: ev.target.yPosition
        });
      }
    });

    // chart.legend = new am4charts.Legend();
    // chart.legend.contentAlign = 'right';
    // chart.legend.fontSize = 12;
    // chart.legend.marginBottom = -15;
    // chart.legend.marginTop = -25;
    // chart.legend.itemContainers.template.clickable = false;
    // chart.legend.itemContainers.template.focusable = false;
    // chart.legend.itemContainers.template.cursorOverStyle = am4core.MouseCursorStyle.default;

    this.charts.push(chart);
    this.updatePeaks(0);
  }

  ngOnInit(): void {
    this.papa.parse('assets/rtu.csv', {
      download: true,
      dynamicTyping: true,
      header: true,
      skipEmptyLines: true,
      complete: result => {
        this.rtuData = result.data.map(record => {
          record.Time = new Date(record.Time);
          return record;
        });
        this.dataReady.next(true);
        this.dataReady.complete();
        this.updateStyles(0);
      }
    });

    this.$peakUncoord.subscribe(value => {
      this.peaks[0].text = `PEAK DEMAND: ${value} kW`;
    });

    this.$peakCoord.subscribe(value => {
      this.peaks[1].text = `PEAK DEMAND: ${value} kW`;
    });
  }

  ngAfterViewInit(): void {
    this.$dataReady.subscribe(ready => {
      if (ready) {
        this.zone.runOutsideAngular(() => {
          this.uncoordData = this.rtuData.map(record => ({
            date: record.Time,
            rtu: record['Bldg (kW) UnCoord'],
            ev: record['Bldg + EV (kW) UnCoord']
            // base: record['Bldg Other (kW) UnCoord']
          }));
          this.coordData = this.rtuData.map(record => ({
            date: record.Time,
            rtu: record['Bldg (kW) Coord'],
            ev: record['Bldg + EV + ESS (kW) Coord']
            // base: record['Bldg Other (kW) Coord']
          }));

          this.createChart('chart-uncoord', this.uncoordData);
          this.createChart('chart-coord', this.coordData);
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.charts.forEach(chart => {
        if (chart) {
          chart.dispose();
        }
      });
    });
  }

  hideCursor(): void {
    this.charts.forEach(chart => {
      chart.cursor.triggerMove({x: 0, y: 0}, 'none');
    });
    this.active = null;
  }

  setView(view: ViewType): void {
    this.view = view;
    localStorage.setItem('view', view);

    this.charts.forEach((chart, i) => {
      if (chart) {
        if (this.view === 'rtu') {
          const title = i === 0 ? 'Base Building' : 'RTU Coordination';
          // @ts-ignore
          chart.chartContainer.children.values[0].children.values[0].setPropertyValue('text', title, true);
          // @ts-ignore
          chart.yAxes.values[0].max = this.rtuData[this.rtuData.length - 1]['Peak Running (kW) UnCoord'];
          chart.series.getIndex(1).hide(0);
          chart.series.getIndex(0).show();
        } else if (this.view === 'ev') {
          const title = i === 0 ? 'Base Building + EVs' : 'RTU Coordination + EVs + ESS';
          // @ts-ignore
          chart.chartContainer.children.values[0].children.values[0].setPropertyValue('text', title, true);
          // @ts-ignore
          chart.yAxes.values[0].max = this.rtuData[this.rtuData.length - 1]['Peak EV (kW) Coord'];
          chart.series.getIndex(0).hide(0);
          chart.series.getIndex(1).show();
        }
      }
    });

    this.update(this.timeIndex.current);
  }

  private update(currentTimeIndex: number): void {
    this.updateBars(currentTimeIndex);
    this.updatePeaks(currentTimeIndex);
    this.updateStyles(currentTimeIndex);
  }

  private updateBars(currentTimeIndex: number): void {
    this.bars.forEach(bar => {
      bar.date = this.rtuData[currentTimeIndex].Time;
    });
  }

  private updatePeaks(currentTimeIndex: number): void {
    if (this.peaks.length === 2) {
      if (this.view === 'rtu') {
        this.peakUncoord.next(this.rtuData[currentTimeIndex]['Peak Running (kW) UnCoord'].toFixed(1));
        this.peakCoord.next(this.rtuData[currentTimeIndex]['Peak Running (kW) Coord'].toFixed(1));
      } else if (this.view === 'ev') {
        this.peakUncoord.next(this.rtuData[currentTimeIndex]['Peak EV (kW) Coord'].toFixed(1));
        this.peakCoord.next(this.rtuData[currentTimeIndex]['Peak ESS (kW) Coord'].toFixed(1));
      }
    }
  }

  private updateCursor(chartIndex: 0 | 1, point: { x: number; y: number }): void {
    const height = this.charts[chartIndex].plotContainer.innerHeight;
    const width = this.charts[chartIndex].plotContainer.innerWidth;
    this.charts[chartIndex].cursor.triggerMove({
      x: point.x * width,
      y: height - (point.y * height)
    }, 'soft');
  }

  private updateStyles(currentTimeIndex): void {
    const data = this.rtuData[currentTimeIndex];
    let left = ['base'];
    let right = ['base'];

    if (data['RTU On Count UnCoord'] > 0) {
      if (data['RTU 1 State UnCoord'] === 1) {
        left.unshift('rtu1');
      }
      if (data['RTU 2 State UnCoord'] === 1) {
        left.unshift('rtu2');
      }
      if (data['RTU 3 State UnCoord'] === 1) {
        left.unshift('rtu3');
      }
      if (data['RTU 4 State UnCoord'] === 1) {
        left.unshift('rtu4');
      }
      if (data['RTU 5 State UnCoord'] === 1) {
        left.unshift('rtu5');
      }
      if (data['RTU 6 State UnCoord'] === 1) {
        left.unshift('rtu6');
      }
    }

    if (data['RTU On Count Coord'] > 0) {
      if (data['RTU 1 State Coord'] === 1) {
        right.unshift('rtu1');
      }
      if (data['RTU 2 State Coord'] === 1) {
        right.unshift('rtu2');
      }
      if (data['RTU 3 State Coord'] === 1) {
        right.unshift('rtu3');
      }
      if (data['RTU 4 State Coord'] === 1) {
        right.unshift('rtu4');
      }
      if (data['RTU 5 State Coord'] === 1) {
        right.unshift('rtu5');
      }
      if (data['RTU 6 State Coord'] === 1) {
        right.unshift('rtu6');
      }
    }

    if (this.view === 'ev') {
      left.unshift('charger');
      right.unshift('charger');

      if (data['Port 2 (kW)'] > 0) {
        left.unshift('tesla-3');
        right.unshift('tesla-3');
      } else {
        left.unshift('tesla-3-translucent');
        right.unshift('tesla-3-translucent');
      }

      if (data['Port 1 (kW)'] > 0) {
        left.unshift('tesla-x');
        right.unshift('tesla-x');
      } else {
        left.unshift('tesla-x-translucent');
        right.unshift('tesla-x-translucent');
      }

      right.unshift('storage');
    }

    left = left.map(img => `url("assets/images/${img}.png")`);
    right = right.map(img => `url("assets/images/${img}.png")`);

    const leftStyle = left.join(', ');
    const rightStyle = right.join(', ');

    if (this.leftStyle !== leftStyle) {
      this.leftStyle = leftStyle;
    }
    if (this.rightStyle !== rightStyle) {
      this.rightStyle = rightStyle;
    }
  }
}
