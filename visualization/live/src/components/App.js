import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import '../styles/App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

function App({socket}) {
    const [nodes, setNodes] = useState({});
    const [links, setLinks] = useState({});

    const [hoverNode, setHoverNode] = useState(null);
    const [highlightNodes, setHighlightNodes] = useState(new Set());
    const [highlightLinks, setHighlightLinks] = useState(new Set());

    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedNodes, setSelectedNodes] = useState(new Set());
    const [selectedLinks, setSelectedLinks] = useState(new Set());

    const [windowSize, setWindowSize] = useState([window.innerWidth, window.innerHeight]);

    const [filterString, setFilterString] = useState('');
    const [filteredNodes, setFilteredNodes] = useState({});
    const [filteredLinks, setFilteredLinks] = useState({});
    const [filterActive, setFilterActive] = useState(false);

    const fgRef = useRef();
    const maxNodes = 250;
    const BFSDepth = 2;

    const nodeGroupNames = {
        1: 'Post',
        2: 'Repost',
        3: 'Person',
        4: 'Highlighted/Selected',
        5: 'Neighbouring Node'
    }

    const nodeColorScheme = {
        1: '#FFC516',
        2: '#E30024',
        3: '#6E0097',
        4: '#4ed5ed',
        5: '#a5ed4e'
    };

    const linkColorScheme = {
        'has root': '#FFC516',
        'has parent': '#E30024',
        'isRepostOf': '#FFFFFF',
        'liked': '#6E0097',
        'followed': '#FF0097',
    };

    useEffect(() => {
        const handleWindowResize = () => {
            setWindowSize([window.innerWidth, window.innerHeight]);
        };
      
        window.addEventListener('resize', handleWindowResize);
    
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

    const updateSelected = useCallback(() => {
        setSelectedNodes(selectedNodes);
        setSelectedLinks(selectedLinks);

        setNodes(previous => {
            return {
                ...previous
            };
        });
    }, [selectedNodes, selectedLinks]);

    const clearSelected = useCallback(() => {
        setSelectedNode(null);
        selectedNodes.clear();
        selectedLinks.clear();
        updateSelected();
    }, [selectedNodes, selectedLinks, updateSelected]);

    const handleClick = useCallback(node => {
        const animationTime = 2000;

        if (node.x === 0 && node.y === 0 && node.z === 0) {
            fgRef.current.cameraPosition({x: 250, y: 250, z: 250}, node, animationTime);
        } else {
            const distance = 500;
            const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
            fgRef.current.cameraPosition({x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio}, node, animationTime);
        }

        if (Object.keys(nodes).length < maxNodes) {
            return;
        }

        clearSelected();

        setTimeout(() => {
            Object.keys(links).forEach(key => {
                let splitRelationship = key.split(' ');
                let firstNode = splitRelationship[0];
                let secondNode = splitRelationship[2];
                
                if (firstNode.startsWith(node.id) || secondNode.startsWith(node.id)) {
                    let link = links[key];

                    selectedLinks.add(link);
                    selectedNodes.add(link.source);
                    selectedNodes.add(link.target);
                }
            });

            setSelectedNode(node);
            updateSelected();
        }, 2000);
    }, [fgRef, nodes, links, selectedNodes, selectedLinks, updateSelected, clearSelected]);

    const updateHighlight = () => {
        setHighlightNodes(highlightNodes);
        setHighlightLinks(highlightLinks);

        setNodes(previous => {
            return {
                ...previous
            };
        });
    };

    const handleNodeHover = node => {
        if (Object.keys(nodes).length < maxNodes) {
            return;
        }

        highlightNodes.clear();
        highlightLinks.clear();

        if (node) {
            highlightNodes.add(node);

            Object.keys(links).forEach(key => {
                let splitRelationship = key.split(' ');
                let firstNode = splitRelationship[0];
                let secondNode = splitRelationship[2];
                
                if (firstNode.startsWith(node.id) || secondNode.startsWith(node.id)) {
                    let link = links[key];

                    highlightLinks.add(link);
                    highlightNodes.add(link.source);
                    highlightNodes.add(link.target);
                }
            });
        }

        setHoverNode(node || null);
        updateHighlight();
    };

    const handleLinkHover = link => {
        if (Object.keys(nodes).length < maxNodes) {
            return;
        }

        highlightNodes.clear();
        highlightLinks.clear();

        if (link) {
            highlightLinks.add(link);
            highlightNodes.add(link.source);
            highlightNodes.add(link.target);
        }

        updateHighlight();
    };

    const filterBFS = (filterStr, currNodes, currLinks, depth) => {
        if (!filterStr) {
            return;
        }

        let tempFilteredNodes = {};
        let tempFilteredLinks = {};

        let currQueue = [];

        Object.values(currNodes).forEach(node => {
            if (node.id.startsWith(filterStr)) {
                tempFilteredNodes[node.id] = node;
                currQueue.push(node);
            }
        });

        for (let i = 0; i < depth; i++) {
            let tempQueue = [];

            currQueue.forEach(node => {                  
                Object.keys(currLinks).forEach(key => {
                    let splitRelationship = key.split(' ');
                    let firstNode = splitRelationship[0];
                    let secondNode = splitRelationship[2];

                    if (firstNode.startsWith(node.id)) {
                        tempFilteredNodes[secondNode] = currNodes[secondNode];
                        tempQueue.push(currNodes[secondNode]);
                    } else if (secondNode.startsWith(node.id)) {
                        tempFilteredNodes[firstNode] = currNodes[firstNode];
                        tempQueue.push(currNodes[firstNode]);
                    } else {
                        return;
                    }

                    tempFilteredLinks[key] = currLinks[key];
                })
            });

            currQueue = tempQueue;
        }

        setFilteredNodes(tempFilteredNodes);
        setFilteredLinks(tempFilteredLinks);
        setFilterActive(true);

        return tempFilteredNodes;
    }

    const handleFilterSubmit = useCallback((e) => {
        e.preventDefault();
        clearSelected();
        let tempFilteredNodes = filterBFS(filterString, nodes, links, BFSDepth);

        if (tempFilteredNodes && Object.keys(tempFilteredNodes).length > 0) {
            let node = tempFilteredNodes[Object.keys(tempFilteredNodes)[0]];
            handleClick(node);
        }
    }, [nodes, links, filterString, clearSelected, handleClick]);

    useEffect(() => {
        const onDelete = msg => {
            let nodeExists = nodes[msg.uri] !== undefined;

            if (nodeExists) {
                setNodes(previous => {
                    let cpy = {...previous};
                    delete cpy[nodes[msg.uri]];

                    return {
                        ...cpy
                    };
                });

                setLinks(previous => {
                    let cpy = {...previous};
                    Object.keys(previous).forEach(key => {
                        let splitRelationship = key.split(' ');
                        let firstNode = splitRelationship[0];
                        let secondNode = splitRelationship[2];
                        
                        if (firstNode.startsWith(msg.uri) || secondNode.startsWith(msg.uri)) {
                            delete cpy[key];
                        }
                    });

                    return {
                        ...cpy
                    };
                });

                if (filterActive) {
                    filterBFS(filterString, nodes, links, BFSDepth);
                }
            }
        }

        const onCreate = msg => {
            if (Object.keys(nodes).length >= maxNodes) {
                return;
            }

            if (msg.type === 'post') {
                setNodes(previous => ({
                    ...previous,
                    [msg.uri]: {
                        id: msg.uri, group: 1, author: msg.author, text: msg.text
                    }
                }));
            } else if (msg.type === 'repost') {
                let originalPostExists = nodes[msg.repostUri] !== undefined;

                if (!originalPostExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.repostUri]: {
                            id: msg.repostUri, group: 1
                        }
                    }));
                }

                setNodes(previous => ({
                    ...previous,
                    [msg.uri]: {
                        id: msg.uri, group: 2, author: msg.author, repostUri: msg.repostUri
                    }
                }));

                setLinks(previous => ({
                    ...previous,
                    [msg.uri + ' isRepostOf ' + msg.repostUri]: {
                        source: msg.uri, target: msg.repostUri, value: 'is a repost of'
                    }
                }));
            }

            if (filterActive) {
                filterBFS(filterString, nodes, links, BFSDepth);
            }
        }

        const onMerge = msg => {
            if (msg.type === 'root') {
                let rootExists = nodes[msg.rootUri] !== undefined;
                let nodeExists = nodes[msg.uri] !== undefined;

                if ((!rootExists || !nodeExists) && Object.keys(nodes).length >= maxNodes) {
                    return;
                }

                if (!rootExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.rootUri]: {
                            id: msg.rootUri, group: 1
                        }
                    }));
                }

                if (!nodeExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.uri]: {
                            id: msg.uri, group: 1
                        }
                    }));
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.uri + ' hasRoot ' + msg.rootUri]: {
                        source: msg.uri, target: msg.rootUri, value: 'has root'
                    }
                }));
            } else if (msg.type === 'parent') {
                let parentExists = nodes[msg.parentUri] !== undefined;
                let nodeExists = nodes[msg.uri] !== undefined;

                if ((!parentExists || !nodeExists) && Object.keys(nodes).length >= maxNodes) {
                    return;
                }

                if (!parentExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.parentUri]: {
                            id: msg.parentUri, group: 1
                        }
                    }));
                }
                
                if (!nodeExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.uri]: {
                            id: msg.uri, group: 1
                        }
                    }));
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.uri + ' hasParent ' + msg.parentUri]: {
                        source: msg.uri, target: msg.parentUri, value: 'has parent'
                    }
                }));
            } else if (msg.type === 'follow') {
                let p1Exists = nodes[msg.authorDid] !== undefined;
                let p2Exists = nodes[msg.subjectDid] !== undefined;

                if ((!p1Exists || !p2Exists) && Object.keys(nodes).length >= maxNodes) {
                    return;
                }

                if (!p1Exists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.authorDid]: {
                            id: msg.authorDid, group: 3
                        }
                    }));
                }

                if (!p2Exists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.subjectDid]: {
                            id: msg.subjectDid, group: 3
                        }
                    }));
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.authorDid + ' followed ' + msg.subjectDid]: {
                        source: msg.authorDid, target: msg.subjectDid, value: 'followed'
                    }
                }));
            } else if (msg.type === 'like') {
                let personExists = nodes[msg.authorDid] !== undefined;
                let postExists = nodes[msg.postUri] !== undefined;
                
                if ((!personExists || !postExists) && Object.keys(nodes).length >= maxNodes) {
                    return;
                }

                if (!personExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.authorDid]: {
                            id: msg.authorDid, group: 3
                        }
                    }));
                }

                if (!postExists) {
                    setNodes(previous => ({
                        ...previous,
                        [msg.postUri]: {
                            id: msg.postUri, group: 1
                        }
                    }));
                }

                setLinks(previous => ({
                    ...previous,
                    [msg.authorDid + ' liked ' + msg.postUri]: {
                        source: msg.authorDid, target: msg.postUri, value: 'liked'
                    }
                }));
            }

            if (filterActive) {
                filterBFS(filterString, nodes, links, BFSDepth);
            }
        }

        const onInitial = msg => {
            console.log(msg);
        }

        socket.on('create', onCreate);
        socket.on('merge', onMerge);
        socket.on('delete', onDelete);
        socket.on('initial', onInitial);

        return () => {
            socket.off('create', onCreate);
            socket.off('merge', onMerge);
            socket.off('delete', onDelete);
            socket.off('initial', onInitial);

        };
    }, [nodes, links, filterString, filterActive, socket]);

    return (
        <>
            <form className='searchbarContainer' onSubmit={handleFilterSubmit}>
                <FontAwesomeIcon className='searchIcon' icon={faMagnifyingGlass}/>
                <input className='searchbar' type='text' value={filterString} onChange={(e) => setFilterString(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFilterSubmit(e)} placeholder='Search using ID...'/>
                <button className='searchClearButton' onClick={(e) => {
                    e.preventDefault();
                    if (filterString) {
                        setFilterString('');
                    }
                    if (filterActive) {
                        setFilterActive(false);
                        setFilteredNodes({});
                        setFilteredLinks({});
                        clearSelected();
                    }
                }}>
                    Clear
                </button>
                <input className='searchSubmitButton' type='submit' value='Search'/>
            </form>
            {filterActive && Object.keys(filteredNodes).length === 0 && 
            <div className='filterWarning'>
                Zero nodes found for submitted search string.
                Please enter a different search string or clear the current one.
            </div>}
            <div className='legend'>
                Node types
                <hr className='legendSeparator'/>
                {Object.keys(nodeColorScheme).map(key => {
                    return (
                        <div className='legendItem'>
                            <div className='legendColor' style={{backgroundColor: nodeColorScheme[key]}}/>
                            <div>
                                {nodeGroupNames[key]}
                            </div>
                        </div>
                    )
                })}
            </div>
            {selectedNode && 
            <div className='nodeInfo'>
                <div className='infoTitle'>
                    Info 
                    <div className='exit' onClick={clearSelected}/>
                </div>
                {
                    selectedNode.id.startsWith('did') ? 
                        <div> Node type: Person <br/> ID: {selectedNode.id} </div> : 
                    selectedNode.text ? 
                        <div> Node type: Post <br/> ID: {selectedNode.id} <br/> Text: {selectedNode.text} </div> :
                    selectedNode.repostUri ? 
                        <div> Node type: Repost <br/> ID: {selectedNode.id} </div> : 
                    <div> Node type: Post <br/> ID: {selectedNode.id} </div>
                }
            </div>}
            <ForceGraph3D
                graphData={filterActive ? {nodes: Object.values(filteredNodes), links: Object.values(filteredLinks)} : {nodes: Object.values(nodes), links: Object.values(links)}}

                ref={fgRef}
                backgroundColor='#71797E'
                showNavInfo={false}

                width={windowSize[0]}
                height={windowSize[1]}

                nodeLabel={node => nodeGroupNames[node.group]}
                nodeRelSize={10}
                nodeColor={node => {
                    if (hoverNode === node || selectedNode === node) {
                        return nodeColorScheme[4]
                    }
                    if (highlightNodes.has(node) || selectedNodes.has(node)) {
                        return nodeColorScheme[5]
                    }
                    return nodeColorScheme[node.group]
                }}
                nodeOpacity={1}

                linkLabel='value'
                linkWidth={link => highlightLinks.has(link) || selectedLinks.has(link) ? 5 : 1}
                linkCurvature={0.25}
                linkColor={link => linkColorScheme[link.value]}

                linkDirectionalArrowLength={link => highlightLinks.has(link) || selectedLinks.has(link) ? 7.5 : 2.5}
                linkDirectionalArrowRelPos={0.5}

                linkDirectionalParticles={link => highlightLinks.has(link) || selectedLinks.has(link) ? 1 : 0}
                linkDirectionalParticleWidth={5}
                linkDirectionalParticleSpeed={0.025}

                onNodeClick={handleClick}
                onNodeHover={handleNodeHover}
                onLinkHover={handleLinkHover}

                forceEngine='d3'
                d3AlphaDecay={highlightLinks.size || highlightNodes.size || selectedNode ? 1 : 0}
                d3VelocityDecay={0.75}
            />
        </>
    );
};

export default App;