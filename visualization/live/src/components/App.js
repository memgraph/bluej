import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import '../styles/App.css';

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

    const max_nodes = 250;

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

    const fgRef = useRef();

    const updateSelected = useCallback(() => {
        setSelectedNodes(selectedNodes);
        setSelectedLinks(selectedLinks);

        setNodes(previous => {
            return {
                ...previous
            };
        });
    }, [selectedNodes, selectedLinks]);

    const handleClick = useCallback(node => {
        const distance = 500;
        const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

        fgRef.current.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);

        if (Object.keys(nodes).length < max_nodes) {
            return;
        }

        setSelectedNode(null);
        selectedNodes.clear();
        selectedLinks.clear();
        updateSelected();

        setTimeout(() => {
            Object.keys(links).forEach(key => {
                let split_relationship = key.split(' ');
                let first_node = split_relationship[0];
                let second_node = split_relationship[2];
                
                if (first_node.startsWith(node.id) || second_node.startsWith(node.id)) {
                    let link = links[key];

                    selectedLinks.add(link);
                    selectedNodes.add(link.source);
                    selectedNodes.add(link.target);
                }
            });

            setSelectedNode(node);
            updateSelected();
        }, 2000);
    }, [fgRef, nodes, links, selectedNodes, selectedLinks, updateSelected]);

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
        if (Object.keys(nodes).length < max_nodes) {
            return;
        }

        highlightNodes.clear();
        highlightLinks.clear();

        if (node) {
            highlightNodes.add(node);

            Object.keys(links).forEach(key => {
                let split_relationship = key.split(' ');
                let first_node = split_relationship[0];
                let second_node = split_relationship[2];
                
                if (first_node.startsWith(node.id) || second_node.startsWith(node.id)) {
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
        if (Object.keys(nodes).length < max_nodes) {
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
                        let split_relationship = key.split(' ');
                        let first_node = split_relationship[0];
                        let second_node = split_relationship[2];
                        
                        if (first_node.startsWith(msg.uri) || second_node.startsWith(msg.uri)) {
                            delete cpy[key];
                        }
                    });

                    return {
                        ...cpy
                    };
                });
            }
        }

        const onCreate = msg => {
            if (Object.keys(nodes).length >= max_nodes) {
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
        }

        const onMerge = msg => {
            if (msg.type === 'root') {
                let rootExists = nodes[msg.rootUri] !== undefined;
                let nodeExists = nodes[msg.uri] !== undefined;

                if ((!rootExists || !nodeExists) && Object.keys(nodes).length >= max_nodes) {
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

                setLinks(previous => ({
                    ...previous,
                    [msg.uri + ' hasRoot ' + msg.rootUri]: {
                        source: msg.uri, target: msg.rootUri, value: 'has root'
                    }
                }));
            } else if (msg.type === 'parent') {
                let parentExists = nodes[msg.parentUri] !== undefined;
                let nodeExists = nodes[msg.uri] !== undefined;

                if ((!parentExists || !nodeExists) && Object.keys(nodes).length >= max_nodes) {
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

                setLinks(previous => ({
                    ...previous,
                    [msg.uri + ' hasParent ' + msg.parentUri]: {
                        source: msg.uri, target: msg.parentUri, value: 'has parent'
                    }
                }));
            } else if (msg.type === 'follow') {
                let p1Exists = nodes[msg.authorDid] !== undefined;
                let p2Exists = nodes[msg.subjectDid] !== undefined;

                if ((!p1Exists || !p2Exists) && Object.keys(nodes).length >= max_nodes) {
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
                
                if ((!personExists || !postExists) && Object.keys(nodes).length >= max_nodes) {
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
        }

        socket.on('create', onCreate);
        socket.on('merge', onMerge);
        socket.on('delete', onDelete);

        return () => {
            socket.off('create', onCreate);
            socket.off('merge', onMerge);
            socket.off('delete', onDelete);
        };
    }, [nodes, socket]);

    return (
        <>
            {selectedNode && 
            <div className='nodeInfo' style={{position: 'absolute', left: `${windowSize[0] / 2 + 50}px`, top: `${windowSize[1] / 2 - 50}px`}}>
                <div className='infoTitle'>
                    Info 
                    <div className='exit' onClick={() => {
                        setSelectedNode(null);
                        selectedNodes.clear();
                        selectedLinks.clear();
                        updateSelected();
                    }}/>
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
            <ForceGraph3D
                graphData={{nodes:Object.values(nodes), links:Object.values(links)}}

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