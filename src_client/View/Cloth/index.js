import 'bootstrap';
import React from 'react';
import { Tree, Button } from 'antd';
import { BiShow, BiHide, BiPointer, BiMinus } from 'react-icons/bi'
const { TreeNode } = Tree;
//antd样式
import 'antd/dist/antd.css';
//渲染窗口
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
//面片拾取
import vtkCellPicker from 'vtk.js/Sources/Rendering/Core/CellPicker';
import { physikaLoadConfig } from '../../IO/LoadConfig'
import { physikaUploadConfig } from '../../IO/UploadConfig'
import { PhysikaTreeNodeAttrModal } from '../TreeNodeAttrModal'
import { physikaLoadObj } from '../../IO/LoadObj';
import { getOrientationMarkerWidget } from '../Widget/OrientationMarkerWidget';

const simtype=1;

class ClothSimulation extends React.Component {
    constructor(props) {
        super(props);
        this.state = {

            data: [],
            treeNodeAttr: {},
            treeNodeText: "",
            treeNodeKey: -1,

            description: [],

            isTreeNodeAttrModalShow: false,
            uploadDisabled: true,
            isSliderShow: false,
        };
    }

    componentDidMount() {
        //---------初始化渲染窗口
        this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
            background: [0.75, 0.76, 0.79],
            rootContainer: geoViewer,
            containerStyle: { height: 'inherit', width: 'inherit' }
        });
        this.renderer = this.fullScreenRenderer.getRenderer();
        this.renderWindow = this.fullScreenRenderer.getRenderWindow();
        this.orientationMarkerWidget = getOrientationMarkerWidget(this.renderWindow);
        //明确一个前提：
        //如果当前帧场景中包含不止一个obj，则这些obj应写在同一个文件中
        //curScene中保存了当前帧中所包含的obj
        //curScene={name:{source, mapper, actor},...}
        this.curScene = {};
        this.fileName = '';
        this.frameSum = 0;
        //worker创建及WebSocket初始化
        this.wsWorker = new WebworkerPromise(new WSWorker());
        this.wsWorker.postMessage({ init: true });
    }

    componentWillUnmount() {
        console.log('子组件将卸载');
        //直接卸载geoViewer中的canvas！！
        let renderWindowDOM = document.getElementById("geoViewer");
        renderWindowDOM.innerHTML = ``;
        //关闭WebSocket
        this.wsWorker.postMessage({ close: true });
        this.wsWorker.terminate();
    }

    clean = () => {
        Object.keys(this.curScene).forEach(key => {
            this.renderer.removeActor(this.curScene[key].actor);
        });
        this.curScene = {};
        this.renderer.resetCamera();
        this.renderWindow.render();

        this.setState({
            description: [],
            animation: false,
            isSliderShow: false,
        });
    }

    load = () => {
        physikaLoadConfig(simtype)
            .then(res => {
                console.log("成功获取初始化配置");
                this.setState({
                    data: res,
                    uploadDisabled: false
                });
            })
            .catch(err => {
                console.log("Error loading: ", err);
            });
    }

    //更新场景
    updateScene = (newScene) => {
        //移除旧场景actor
        Object.keys(this.curScene).forEach(key => {
            this.renderer.removeActor(this.curScene[key].actor);
        });
        this.curScene = newScene;
        //添加新场景actor
        Object.keys(this.curScene).forEach(key => {
            this.renderer.addActor(this.curScene[key].actor);
        });
        this.renderer.resetCamera();
        this.renderWindow.render();
    }

    //改变actor的可见性
    changeVisible = (item) => {
        const actor = this.curScene[item._attributes.name].actor;
        const visibility = actor.getVisibility();
        actor.setVisibility(!visibility);
        //因为actor可见性的变化不会触发组件的render，
        //所以这里强制触发render，使得BiShow控件变为BiHide控件
        this.forceUpdate();
        this.renderWindow.render();
    }

    //递归渲染每个树节点（这里必须用map遍历！可能因为需要返回的数组？）
    renderTreeNodes = (data) => data.map((item, index) => {
        item.title = (
            <div>
                {
                    (item.tag === 'Node') &&
                    (this.curScene[item._attributes.name].actor.getVisibility()
                        ? <BiShow onClick={() => this.changeVisible(item)}></BiShow>
                        : <BiHide onClick={() => this.changeVisible(item)}></BiHide>)
                }
                <Button type="text" size="small" onClick={() => this.showTreeNodeAttrModal(item)}>{item._attributes.name}</Button>
                {
                    (item.tag === 'Node') &&
                    <BiPointer onClick={() => this.cellPick(item)}></BiPointer>
                }
                {
                    (item.tag === 'Cell') &&
                    <BiMinus onClick={() => this.deleteNode(item.key)}></BiMinus>
                }
            </div>
        );

        if (item.children) {
            return (
                <TreeNode title={item.title} key={item.key} >
                    {this.renderTreeNodes(item.children)}
                </TreeNode>
            );
        }

        return <TreeNode {...item} />;
    });

    showTreeNodeAttrModal = (item) => {
        this.setState({
            isTreeNodeAttrModalShow: true,
            treeNodeAttr: item._attributes,
            treeNodeKey: item.key,
            treeNodeText: item._text
        });
    }

    hideTreeNodeAttrModal = () => {
        this.setState({
            isTreeNodeAttrModalShow: false
        });
    }

    //接收TreeNodeAttrModal返回的结点数据并更新树
    changeData = (obj) => {
        //注意：这里直接改变this.state.data本身不会触发渲染，
        //真正触发渲染的是hideTreeNodeAttrModal()函数的setState！
        //官方并不建议直接修改this.state中的值，因为这样不会触发渲染，
        //但是React的setState本身并不能处理nested object的更新。
        //若该函数不再包含hideTreeNodeAttrModal()函数，则需要另想办法更新this.state.data！
        let eachKey = this.state.treeNodeKey.split('-');
        let count = 0;
        const findTreeNodeKey = (node) => {
            if (count === eachKey.length - 1) {
                //找到treeNodeKey对应树结点，更新数据
                if (obj.hasOwnProperty('_text')) {
                    node[eachKey[count]]._text = obj._text;
                }
                //若以后需修改_attributes属性，则在此添加代码
                return;
            }
            findTreeNodeKey(node[eachKey[count++]].children);
        };
        findTreeNodeKey(this.state.data);
        this.hideTreeNodeAttrModal();
    }

    upload = () => {
        if (this.state.data.length == 0) {
            alert("还未加载配置文件！");
        }
        else {
            //第一个参数data，第二个参数仿真类型
            physikaUploadConfig(this.state.data, 'cloth')
                .then(res => {
                    console.log("成功上传配置并获取到仿真结果配置");
                    let options = this.extractURL(res);
                    return Promise.all([physikaLoadObj(options), res]);
                })
                .then(res => {
                    console.log("成功获取仿真结果模型", res);
                    this.frameSeq = res[0];
                    this.updateScene(this.frameSeq[0]);
                    this.setState({ data: res[1] });
                })
                .catch(err => {
                    console.log("Error uploading: ", err);
                });
        }
    }

    //---------2020.10.15 面片选取----------
    cellPick = (item) => {
        console.log("开始选取");

        const picker = vtkCellPicker.newInstance();
        picker.setPickFromList(true);
        picker.setTolerance(0);
        picker.initializePickList();
        picker.addPickList(this.curScene[item._attributes.name].actor);
        //console.log(picker.getPickList());

        const subscription = this.renderWindow.getInteractor().onRightButtonPress((callData) => {
            if (this.renderer !== callData.pokedRenderer) {
                return;
            }

            const pos = callData.position;
            const point = [pos.x, pos.y, 0.0];
            console.log(`Pick at: ${point}`);
            picker.pick(point, this.renderer);

            if (picker.getActors().length === 0) {
                const pickedPoint = picker.getPickPosition();
                console.log(`No cells picked, default: ${pickedPoint}`);
            }
            else {
                const pickedCellId = picker.getCellId();
                console.log('Picked cell: ', pickedCellId);
                const pickedPoints = picker.getPickedPositions();
                for (let i = 0; i < pickedPoints.length; i++) {
                    const pickedPoint = pickedPoints[i];
                    console.log(`Picked: ${pickedPoint}`);
                }
                //添加选定节点
                this.showTreeNodeAttrModal(addPickedCell(pickedCellId, item));
            }
            //取消鼠标右键点击的订阅（2020.10.17）
            subscription.unsubscribe();
        });
    }
    //------------------------------------

    //删除指定树节点（其父节点保留）
    deleteNode = (treeNodeKey) => {
        let eachKey = treeNodeKey.split('-');
        let count = 0;
        const findTreeNodeKey = (node) => {
            //找到treeNodeKey所在的children数组
            if (count === eachKey.length - 1) {
                //删除对应节点
                node.splice(eachKey[count], 1);
                //父节点key值变化，所以其所有子结点的key值也需要更新！
                const changeNodeKey = (node_, fatherNodeKey) =>
                    node_.forEach((item, index) => {
                        item.key = fatherNodeKey + index;
                        if (item.hasOwnProperty('children')) {
                            changeNodeKey(item.children, item.key + '-');
                        }
                    });
                changeNodeKey(node, treeNodeKey.slice(0, treeNodeKey.length - 1));
                return;
            }
            findTreeNodeKey(node[eachKey[count++]].children);
        };
        findTreeNodeKey(this.state.data);
        this.forceUpdate();
    }
    //------------------------------------

    //2020.11.9 实现动画
    drawFrame = () => {
        const currentTime = new Date().getTime();
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
        }
        const elapsed = currentTime - this.lastTime;
        if (elapsed > (1000 / this.fps)) {
            this.lastTime = currentTime - (elapsed % (1000 / this.fps));
            if (this.frameSeqIndex === this.frameSeq.length) {
                cancelAnimationFrame(this.rAF);
                this.frameSeqIndex = 0;
                console.log("动画结束");
                return;
            }
            this.updateScene(this.frameSeq[this.frameSeqIndex]);
            this.frameSeqIndex++;
        }
        this.rAF = requestAnimationFrame(this.drawFrame);
    }

    stopDrawFrame = () => {
        cancelAnimationFrame(this.rAF);
        console.log("动画暂停");
    }
    //-----------------------------------

    render() {
        console.log("tree:", this.state.data);
        return (
            <div className="w-100">
                <div className="card border rounded-0"><span className="text-center m-1">几何展示</span>
                    <hr className="m-0" />
                    <div className="card-body pt-2">
                        <button className="btn btn-danger btn-sm p-0 btn-block" type="button" onClick={this.load}><span className="glyphicon glyphicon-plus">加载场景</span></button>
                        <div className="pt-2" style={{ overflowY: 'auto', height: '333px' }}>
                            <Tree style={{ overflowX: 'auto', width: '176px' }}>
                                {this.renderTreeNodes(this.state.data)}
                            </Tree>
                        </div>

                        <button className="btn btn-danger btn-sm p-0 btn-block" type="button" onClick={this.upload}><span className="glyphicon glyphicon-plus">执行仿真</span></button>
                        <Button type="text" size="small" onClick={this.drawFrame}>播放动画</Button>
                        <Button type="text" size="small" onClick={this.stopDrawFrame}>暂停动画</Button>
                    </div>
                    <div >
                        <PhysikaTreeNodeAttrModal
                            treeNodeAttr={this.state.treeNodeAttr}
                            treeNodeText={this.state.treeNodeText}
                            visible={this.state.isTreeNodeAttrModalShow}
                            hideModal={this.hideTreeNodeAttrModal}
                            changeData={(obj) => this.changeData(obj)}
                        ></PhysikaTreeNodeAttrModal>
                    </div>
                </div>
            </div>
        );
    }
}

//react模块名字首字母必须大写！
export {
    ClothSimulation as PhysikaClothSimulation
};
