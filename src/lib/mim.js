import TIM from 'tim-js-sdk';

// const TIM = (await import('tim-js-sdk')).default;
// 配置
let options = {
  SDKAppID: 1400639905
};
let tim = null;

export function getTim() {
  if (tim == null) {
    tim = TIM.create(options);
  }
  return tim;
}

export function getTIM() {
  return TIM;
}