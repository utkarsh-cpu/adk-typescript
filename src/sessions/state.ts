// TODO: Implement
export class State {
    static readonly APP_PREFIX: string = "app:"
    static readonly USER_PREFIX:string = "user:"
    static readonly TEMP_PREFIX:string = "temp:"
    
    private _value: Record<string,any>
    private _delta: Record<string,any>
    constructor(
        value:Record<string,any>,
        delta: Record<string,any>){
            this._value=value
            this._delta=delta
    }
    get(key:string):any;
    get(key: string, defaultValue: any): any;
    get(key: string, defaultValue?: any): any {
        if (key in this._delta) {
            return this._delta[key];
        }
        if (key in this._value) {
            return this._value[key];
        }
        return defaultValue;
    }
    set(key:string,value:any):void{
        this._value[key]=value;
        this._delta[key]=value;

    }
    has(key:string): boolean{
        return key in this._value || key in this._delta;
    }
    hasDelta():boolean{
        return Object.keys(this._delta).length>0;
    }
    update(delta:Record<string,any>): void{
        Object.assign(this._value,delta);
        Object.assign(this._delta,delta);
    }
    toDict():Record<string,any>{
        const result: Record<string, any> = {};
        Object.assign(result,this._value);
        Object.assign(result,this._delta);
        return result;
    }
    [key: string]: any;
}
