import { createNamespace } from '../utils';
import { range } from '../utils/format/number';
import { isDate } from '../utils/validate/date';
import { padZero } from '../utils/format/string';
import Picker from '../picker';
import { pickerProps } from '../picker/shared';
import { times, getTrueValue, getMonthEndDay } from './utils';

const [createComponent, bem] = createNamespace('datetime-picker');
const currentYear = new Date().getFullYear();

export default createComponent({
  props: {
    ...pickerProps,
    value: null,
    filter: Function,
    minHour: {
      type: Number,
      default: 0
    },
    minMinute: {
      type: Number,
      default: 0
    },
    type: {
      type: String,
      default: 'datetime'
    },
    showToolbar: {
      type: Boolean,
      default: true
    },
    format: {
      type: String,
      default: 'YYYY.MM.DD HH时 mm分'
    },
    formatter: {
      type: Function,
      default: (type, value) => value
    },
    minDate: {
      type: Date,
      default: () => new Date(currentYear - 10, 0, 1),
      validator: isDate
    },
    maxDate: {
      type: Date,
      default: () => new Date(currentYear + 10, 11, 31),
      validator: isDate
    },
    maxHour: {
      type: Number,
      default: 23
    },
    maxMinute: {
      type: Number,
      default: 59
    }
  },

  data() {
    return {
      innerValue: this.correctValue(this.value)
    };
  },

  watch: {
    value(val) {
      val = this.correctValue(val);

      const isEqual =
        this.type === 'time'
          ? val === this.innerValue
          : val.valueOf() === this.innerValue.valueOf();

      if (!isEqual) {
        this.innerValue = val;

        if (this.type === 'time') {
          this.updateColumnValue(val);
        }
      }
    },

    innerValue(val) {
      this.$emit('input', val);
    },

    columns() {
      this.updateColumnValue(this.innerValue);
    }
  },

  computed: {
    ranges() {
      if (this.type === 'time') {
        return [
          {
            type: 'hour',
            range: [this.minHour, this.maxHour]
          },
          {
            type: 'minute',
            range: [this.minMinute, this.maxMinute]
          }
        ];
      }

      const { maxYear, maxDate, maxMonth, maxHour, maxMinute } = this.getBoundary(
        'max',
        this.innerValue
      );

      const { minYear, minDate, minMonth, minHour, minMinute } = this.getBoundary(
        'min',
        this.innerValue
      );

      const result = [
        {
          type: 'year',
          range: [minYear, maxYear]
        },
        {
          type: 'month',
          range: [minMonth, maxMonth]
        },
        {
          type: 'day',
          range: [minDate, maxDate]
        },
        {
          type: 'hour',
          range: [minHour, maxHour]
        },
        {
          type: 'minute',
          range: [minMinute, maxMinute]
        }
      ];

      if (this.type === 'date') result.splice(3, 2);
      if (this.type === 'year-month') result.splice(2, 3);
      return result;
    },

    originColumns() {
      return this.ranges.map(({ type, range: rangeArr }) => {
        let values = times(rangeArr[1] - rangeArr[0] + 1, index => {
          const value = padZero(rangeArr[0] + index);
          return value;
        });

        if (this.filter) {
          values = this.filter(type, values);
        }

        return {
          type,
          values
        };
      });
    },

    columns() {
      return this.originColumns.map(column => ({
        values: column.values.map(value => this.formatter(column.type, value))
      }));
    }
  },

  mounted() {
    this.updateColumnValue(this.innerValue);
  },

  methods: {
    correctValue(value) {
      // validate value
      const isDateType = this.type !== 'time';

      if (isDateType && !isDate(value)) {
        value = this.minDate;
      } else if (!value) {
        value = `${padZero(this.minHour)}:00`;
      }

      // time type
      if (!isDateType) {
        let [hour, minute] = value.split(':');
        hour = padZero(range(hour, this.minHour, this.maxHour));
        minute = padZero(range(minute, this.minMinute, this.maxMinute));

        return `${hour}:${minute}`;
      }

      // date type
      value = Math.max(value, this.minDate.getTime());
      value = Math.min(value, this.maxDate.getTime());

      return new Date(value);
    },

    getBoundary(type, value) {
      const boundary = this[`${type}Date`];
      const year = boundary.getFullYear();
      let month = 1;
      let date = 1;
      let hour = 0;
      let minute = 0;

      if (type === 'max') {
        month = 12;
        date = getMonthEndDay(value.getFullYear(), value.getMonth() + 1);
        hour = 23;
        minute = 59;
      }

      if (value.getFullYear() === year) {
        month = boundary.getMonth() + 1;
        if (value.getMonth() + 1 === month) {
          date = boundary.getDate();
          if (value.getDate() === date) {
            hour = boundary.getHours();
            if (value.getHours() === hour) {
              minute = boundary.getMinutes();
            }
          }
        }
      }

      return {
        [`${type}Year`]: year,
        [`${type}Month`]: month,
        [`${type}Date`]: date,
        [`${type}Hour`]: hour,
        [`${type}Minute`]: minute
      };
    },

    onConfirm() {
      this.$emit('confirm', this.innerValue);
    },

    onChange(picker) {
      let value;

      if (this.type === 'time') {
        const indexes = picker.getIndexes();
        const hour = this.originColumns[0].values[indexes[0]];
        const minute = this.originColumns[1].values[indexes[1]];

        value = `${hour}:${minute}`;
      } else {
        const values = picker.getValues();
        const year = getTrueValue(values[0]);
        const month = getTrueValue(values[1]);
        const maxDate = getMonthEndDay(year, month);

        let date = getTrueValue(values[2]);
        if (this.type === 'year-month') {
          date = 1;
        }

        date = date > maxDate ? maxDate : date;

        let hour = 0;
        let minute = 0;

        if (this.type === 'datetime') {
          hour = getTrueValue(values[3]);
          minute = getTrueValue(values[4]);
        }

        value = new Date(year, month - 1, date, hour, minute);
      }

      this.innerValue = this.correctValue(value);

      this.$nextTick(() => {
        this.$nextTick(() => {
          this.$emit('change', picker);
        });
      });
    },

    updateColumnValue(value) {
      let values = [];
      const { formatter } = this;

      if (this.type === 'time') {
        const pair = value.split(':');
        values = [formatter('hour', pair[0]), formatter('minute', pair[1])];
      } else {
        values = [
          formatter('year', `${value.getFullYear()}`),
          formatter('month', padZero(value.getMonth() + 1)),
          formatter('day', padZero(value.getDate()))
        ];

        if (this.type === 'datetime') {
          values.push(
            formatter('hour', padZero(value.getHours())),
            formatter('minute', padZero(value.getMinutes()))
          );
        }

        if (this.type === 'year-month') {
          values = values.slice(0, 2);
        }
      }

      this.$nextTick(() => {
        this.$refs.picker.setValues(values);
      });
    }
  },

  render() {
    const props = {};
    Object.keys(pickerProps).forEach(key => {
      props[key] = this[key];
    });

    return (
      <Picker
        class={bem()}
        ref="picker"
        columns={this.columns}
        onChange={this.onChange}
        onConfirm={this.onConfirm}
        onCancel={() => {
          this.$emit('cancel');
        }}
        {...{ props }}
      />
    );
  }
});
